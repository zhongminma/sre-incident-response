# SRE Incident Response & Observability Lab

Production-style incident investigation lab using OpenTelemetry, Prometheus, Grafana, Jaeger, PostgreSQL, and Kubernetes.

This repository demonstrates how Site Reliability Engineers investigate production incidents using metrics, logs, and distributed tracing to reduce MTTR and validate system recovery.

## Target Stack

- OpenTelemetry for instrumentation
- Prometheus for metrics
- Grafana for dashboards
- Jaeger for distributed tracing
- Kubernetes for deployment and incident simulation

## SRE Skills Demonstrated

### Observability

- Metrics (Prometheus)
- Dashboards (Grafana)
- Distributed Tracing (OpenTelemetry + Jaeger)

### Incident Response

- Alert Investigation
- Root Cause Analysis
- Incident Mitigation
- Verification

### Reliability Engineering

- P95 Latency Analysis
- Error Rate Monitoring
- Service Health Validation

### Kubernetes

- Containerized Deployment
- Service Discovery
- Metrics Collection


## First Incident Scenario - DB_pool_size

<img width="1646" height="688" alt="Screenshot 2026-06-08 at 14 38 06" src="https://github.com/user-attachments/assets/adac2067-c8d5-481f-8fe7-d22e308d7b08" />

**High Latency caused by Database Connection Pool Exhaustion**

Expected symptom:
```text
P95 latency: 900ms -> 2500ms
```
Investigation path:
```text
Grafana
  -> Prometheus
  -> Logs
  -> Jaeger traces
  -> Root cause analysis
```
<img width="3287" height="523" alt="mermaid-diagram (1)" src="https://github.com/user-attachments/assets/094a4f2f-f923-4c1c-813d-8692e5ba5f01" />

## Incident Investigation Workflow
1. Alert Triggered with P95 latency > 2.5s (should send email or warning message via slack to inform the related team)
<img width="1478" height="530" alt="Screenshot 2026-06-08 at 15 39 12" src="https://github.com/user-attachments/assets/2fc5e8fe-b1bc-4d8d-b6dc-151d83b5c16e" />


2. In the Prometheus Metrics, the Prometheus is working properly and Prometheus scrape metrics is healthy.

<img width="1658" height="370" alt="Screenshot 2026-06-08 at 10 57 21" src="https://github.com/user-attachments/assets/bfc11317-ed7d-4316-a002-280bc36cd08a" />

4. In the Grafana Dashboard, the application downstream is unhealthy, P95 latency is very high and error rate has a spike.

<img width="1646" height="708" alt="Screenshot 2026-06-08 at 14 31 48" src="https://github.com/user-attachments/assets/313abd9c-bf81-4a07-9109-b9c40b24a99a" />

6. Application Logs show Connection acquisition timeout

<img width="1025" height="189" alt="Screenshot 2026-06-08 at 14 31 04" src="https://github.com/user-attachments/assets/f5ee3417-b875-4478-91c5-80ab3b03d185" />

8. From JaegerUI Distributed Tracing, the error is found as Large spans waiting for DB pool.

<img width="1655" height="848" alt="Screenshot 2026-06-08 at 14 42 56" src="https://github.com/user-attachments/assets/597ce362-96ac-4828-b587-9ef88e67deec" />

10. Root Cause is "Database connection pool exhausted".

11. Mitigation
- Increased connection pool size from 2 to 20
- Optimize query execution

8. Verification
- P95 recovered to < 1s
- Error rate normalized

## Second Incident Scenario - OOMKilled

1. Prometheus triggered alert

<img width="1472" height="558" alt="Screenshot 2026-06-08 at 16 31 44" src="https://github.com/user-attachments/assets/aa31d124-77d1-4956-8105-093fb89e6d68" />

2. Grafana showed pod restart count and memory usage has a spike.
<img width="1327" height="849" alt="Screenshot 2026-06-08 at 16 43 21" src="https://github.com/user-attachments/assets/05551ff3-0d21-4626-9da5-888325f9a20b" />

3. kubectl describe the Pod and find the OOMKilled as well
<img width="1018" height="324" alt="Screenshot 2026-06-08 at 16 37 48" src="https://github.com/user-attachments/assets/b14b00d8-d03b-4133-b46b-c365f8fac670" />

4. kubectl logs confirmed Memory Leak Behavior
<img width="776" height="290" alt="Screenshot 2026-06-08 at 16 35 29" src="https://github.com/user-attachments/assets/477a5d9a-7043-4945-9b15-e07499ef1700" />

5. RCA: check memory status and showed the memory is leaking

<img width="982" height="40" alt="Screenshot 2026-06-08 at 16 59 00" src="https://github.com/user-attachments/assets/6750f052-6e83-4336-8f87-eaa6abb6a3e9" />

6. Resolution: top calling /memory-leak and restart the deployment
```text
kubectl rollout restart deployment/checkout-service -n sre-lab
```

9. validation pass (validate either via Grafana or curl /health or kubectl pods status)

<img width="1476" height="844" alt="Screenshot 2026-06-08 at 17 03 33" src="https://github.com/user-attachments/assets/33020ddb-195a-47db-b0ed-1bbe00db363d" />


## Implementation Approach
The lab will be built step by step. Each step adds one small feature and is committed separately.
Initial milestones:
1. Create the project overview.
2. Add a minimal checkout API.
3. Add PostgreSQL.
4. Simulate DB connection pool exhaustion.
5. Expose Prometheus metrics.
6. Add Grafana dashboard.
7. Add OpenTelemetry tracing.
8. Export traces to Jaeger.
9. Deploy the lab to Kubernetes.


