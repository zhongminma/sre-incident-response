# Incident: Memory Leak Caused by Kubernetes OOMKilled

## Scenario

The checkout service leaks memory until Kubernetes kills and restarts the container.

Expected symptom:

```text
Memory usage grows steadily
Pod restarts increase
Container last state shows OOMKilled
```

Investigation flow:

```text
Grafana
  -> Memory Growth
  -> Pod Restart Count
  -> kubectl describe pod
  -> OOMKilled
  -> Heap Analysis
  -> Memory Leak
```

## Lab Setup

This scenario runs in Kubernetes.

The checkout service has a low memory limit:

```yaml
resources:
  requests:
    memory: 64Mi
  limits:
    memory: 128Mi
```

The service exposes two memory endpoints:

```text
GET /memory-leak?mb=20
GET /memory-status
```

Each `/memory-leak` request retains memory inside the Node.js process. After enough retained memory, the container exceeds its Kubernetes memory limit and is killed by kubelet.

## Prerequisites

You need:

```bash
kubectl version --client
docker --version
k6 version
```

You also need a local Kubernetes cluster, such as Docker Desktop Kubernetes, minikube, or kind.

If using Docker Desktop Kubernetes, make sure Kubernetes is enabled in Docker Desktop settings.

## 1. Build the Checkout Image

From the project root:

```bash
cd /Users/kevinma/Documents/sre-incident-response
docker build -t checkout-service:latest services/checkout-service
```

If you use minikube, build the image inside the minikube Docker environment:

```bash
eval $(minikube docker-env)
docker build -t checkout-service:latest services/checkout-service
```

## 2. Deploy the Kubernetes Lab

Apply the base manifests:

```bash
kubectl apply -k k8s/base
```

Wait for pods:

```bash
kubectl get pods -n sre-lab -w
```

Expected pods:

```text
checkout-service
postgres
prometheus
grafana
jaeger
```

## 3. Open Grafana and Prometheus

Port-forward Grafana:

```bash
kubectl port-forward -n sre-lab svc/grafana 3001:3000
```

Open:

```text
http://localhost:3001
```

Default credentials:

```text
admin / admin
```

Port-forward Prometheus in another terminal:

```bash
kubectl port-forward -n sre-lab svc/prometheus 9090:9090
```

Open:

```text
http://localhost:9090
```

## 4. Verify Checkout Service

Port-forward checkout-service:

```bash
kubectl port-forward -n sre-lab svc/checkout-service 3000:3000
```

Check health:

```bash
curl http://localhost:3000/health
```

Check current memory:

```bash
curl http://localhost:3000/memory-status
```

Expected response includes:

```text
rssMb
heapUsedMb
externalMb
leakedMb
```

## 5. Trigger the Memory Leak

In a terminal with checkout-service port-forward running:

```bash
k6 run load/memory-leak.js
```

Default load settings:

```text
ITERATIONS=10
LEAK_MB=20
SLEEP_SECONDS=2
```

You can make the leak more aggressive:

```bash
LEAK_MB=40 ITERATIONS=10 k6 run load/memory-leak.js
```

If you do not have k6 installed, use curl:

```bash
for i in {1..10}; do
  curl "http://localhost:3000/memory-leak?mb=20"
  echo
  sleep 2
done
```

Expected behavior:

```text
rssMb and externalMb grow after each request.
The checkout-service pod eventually restarts.
```

If the pod does not restart, run the loop again. The exact number of requests depends on baseline memory usage in your local Kubernetes runtime.

## 6. Grafana: Memory Growth

Open:

```text
SRE Lab / Kubernetes OOMKilled Incident
```

Check:

```text
Checkout Memory Growth
Memory Usage vs Limit
```

Expected finding:

```text
Memory climbs toward the 128Mi limit before the pod restarts.
```

## 7. Grafana: Pod Restart Count

Check:

```text
Checkout Pod Restart Count
OOMKilled Last Termination
```

Expected finding:

```text
Restart count increases after the container is killed.
```

## 8. Kubernetes: Describe the Pod

Find the checkout pod:

```bash
kubectl get pods -n sre-lab -l app=checkout-service
```

Describe it:

```bash
kubectl describe pod -n sre-lab -l app=checkout-service
```

Look for:

```text
Last State:   Terminated
Reason:       OOMKilled
Exit Code:    137
```

Expected conclusion:

```text
Kubernetes killed the checkout-service container because it exceeded its memory limit.
```

## 9. Logs: Confirm Memory Leak Behavior

Check current container logs:

```bash
kubectl logs -n sre-lab deploy/checkout-service
```

Check previous container logs after restart:

```bash
kubectl logs -n sre-lab deploy/checkout-service --previous
```

Look for:

```text
memory leak chunk retained
```

Expected finding:

```text
The application repeatedly retained memory before the OOMKilled restart.
```

## 10. Heap Analysis

This demo does not create a heap snapshot file yet. The first-pass heap analysis uses runtime memory fields from `/memory-status`:

```bash
curl http://localhost:3000/memory-status
```

Interpretation:

```text
rssMb grows as total process memory grows.
externalMb grows because the demo retains Buffer objects outside the V8 heap.
leakedMb grows with each retained memory chunk.
heapUsedMb may stay lower than rssMb because Buffer memory is external memory.
```

Expected conclusion:

```text
The memory leak is retained Buffer allocations in the Node.js process.
```

## 11. Root Cause

The `/memory-leak` endpoint stores allocated Buffer objects in a process-level array and never releases them.

Root cause pattern:

```text
Unbounded in-memory retention
```

In production, similar leaks can come from:

```text
Unbounded caches
Global arrays or maps
Request data stored without TTL
Large buffers retained after request completion
Missing cleanup in background jobs
```

## 12. Fix

For this demo, stop calling `/memory-leak` and restart the deployment:

```bash
kubectl rollout restart deployment/checkout-service -n sre-lab
```

Wait for recovery:

```bash
kubectl rollout status deployment/checkout-service -n sre-lab
```

Production fixes should remove the unbounded retention pattern, add cache limits, or release large objects after request completion.

## 13. Verify Recovery

Check pod status:

```bash
kubectl get pods -n sre-lab -l app=checkout-service
```

Check memory status:

```bash
curl http://localhost:3000/memory-status
```

Expected recovery:

```text
Pod is Running
Memory returns to baseline
Restart count stops increasing
```

## 14. Clean Up

Delete the lab:

```bash
kubectl delete -k k8s/base
```

## Troubleshooting

If the image cannot be pulled:

```text
Confirm checkout-service:latest exists in the Kubernetes node runtime.
For minikube, rebuild after eval $(minikube docker-env).
For kind, load the image with kind load docker-image checkout-service:latest.
```

If `/memory-leak` does not trigger OOMKilled:

```text
Run the loop again.
Increase mb to 40: curl "http://localhost:3000/memory-leak?mb=40".
Confirm the pod has memory limit 128Mi with kubectl describe pod.
```

If Grafana has no memory data:

```text
Confirm Prometheus is scraping Kubernetes container metrics.
Open Prometheus and query container_memory_working_set_bytes.
```
