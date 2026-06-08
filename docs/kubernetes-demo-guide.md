# Kubernetes Demo Guide

This guide runs the SRE Incident Response lab on Kubernetes.

The Kubernetes version includes:

- checkout-service
- PostgreSQL
- Prometheus
- Grafana
- Jaeger

## Prerequisites

Use a local Kubernetes cluster such as Docker Desktop Kubernetes, kind, or minikube.

Required tools:

```bash
kubectl
docker
k6
```

## 1. Build the Checkout Service Image

Build the local image:

```bash
docker build -t checkout-service:latest services/checkout-service
```

If you use Docker Desktop Kubernetes, the cluster can usually use this local image directly.

If you use kind:

```bash
kind load docker-image checkout-service:latest
```

If you use minikube:

```bash
minikube image load checkout-service:latest
```

## 2. Deploy the Lab

Render the manifests:

```bash
kubectl kustomize k8s/base
```

Apply the manifests:

```bash
kubectl apply -k k8s/base
```

Check pods:

```bash
kubectl get pods -n sre-lab
```

Expected components:

```text
checkout-service
postgres
prometheus
grafana
jaeger
```

## 3. Port Forward Local Access

These local ports intentionally avoid the Docker Compose demo ports. This lets Docker Compose and Kubernetes run at the same time without sending browser or k6 traffic to the wrong environment.

Checkout service:

```bash
kubectl port-forward -n sre-lab svc/checkout-service 3002:3000
```

Prometheus:

```bash
kubectl port-forward -n sre-lab svc/prometheus 9190:9090
```

Grafana:

```bash
kubectl port-forward -n sre-lab svc/grafana 3101:3000
```

Jaeger:

```bash
kubectl port-forward -n sre-lab svc/jaeger 16687:16686
```

## 4. Verify the Application

Health check:

```bash
curl http://localhost:3002/health
```

Checkout request:

```bash
curl http://localhost:3002/checkout
```

Metrics:

```bash
curl http://localhost:3002/metrics
```

## 5. Trigger the Incident

Run the load test:

```bash
BASE_URL=http://localhost:3002 k6 run load/high-latency.js
```

The default Kubernetes configuration uses:

```text
DB_POOL_SIZE=2
SIMULATED_DB_WORK_MS=800
```

This causes requests to queue for database connections under load.

## 6. Investigate in Grafana

Open Grafana:

```text
http://localhost:3101
```

Default credentials:

```text
admin / admin
```

Dashboard:

```text
SRE Lab / Checkout Latency Incident
```

Look for:

- Checkout P95 latency increase
- Request rate during the load test
- Error rate if connection acquisition times out

## 7. Investigate in Prometheus

Open Prometheus:

```text
http://localhost:9190
```

P95 latency query:

```promql
histogram_quantile(
  0.95,
  sum(rate(http_request_duration_seconds_bucket{route="/checkout"}[5m])) by (le)
)
```

Request rate:

```promql
sum(rate(http_request_duration_seconds_count{route="/checkout"}[5m]))
```

## 8. Investigate in Jaeger

Open Jaeger:

```text
http://localhost:16687
```

Search for service:

```text
checkout-service
```

Look for slow `/checkout` traces.

Expected trace signals:

- HTTP server span for `/checkout`
- PostgreSQL spans from the `pg` client
- Longer request duration during the incident

## 9. Check Logs

Checkout service logs:

```bash
kubectl logs -n sre-lab deploy/checkout-service -f
```

Look for:

```text
checkout request waiting for database connection
checkout request acquired database connection
checkout request released database connection
checkout database operation failed
```

## 10. Clean Up

Delete the lab:

```bash
kubectl delete -k k8s/base
```

## Notes

The current Kubernetes base manifests intentionally simulate the incident with a small database pool.

Future overlays can add:

- fixed pool size
- local image registry settings
- persistent PostgreSQL storage
- ingress or load balancer access
