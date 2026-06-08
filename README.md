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


## First Incident Scenario

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
## Troubleshoot workflow
<img width="3287" height="523" alt="mermaid-diagram (1)" src="https://github.com/user-attachments/assets/094a4f2f-f923-4c1c-813d-8692e5ba5f01" />


## screenshots
1. Prometheus is working properly and Prometheus scrape metrics is healthy.
<img width="1658" height="370" alt="Screenshot 2026-06-08 at 10 57 21" src="https://github.com/user-attachments/assets/bfc11317-ed7d-4316-a002-280bc36cd08a" />

2. However, application downstream is unhealthy, P95 latency is very high and error rate is spike. 
<img width="1646" height="708" alt="Screenshot 2026-06-08 at 14 31 48" src="https://github.com/user-attachments/assets/313abd9c-bf81-4a07-9109-b9c40b24a99a" />

3. Check logs
<img width="1025" height="189" alt="Screenshot 2026-06-08 at 14 31 04" src="https://github.com/user-attachments/assets/f5ee3417-b875-4478-91c5-80ab3b03d185" />

4. From JaegerUI Distributed Tracing
<img width="1655" height="848" alt="Screenshot 2026-06-08 at 14 42 56" src="https://github.com/user-attachments/assets/597ce362-96ac-4828-b587-9ef88e67deec" />

## Root Cause

Database connection pool was configured with a maximum of 2 active connections.
During load testing, concurrent requests exceeded available database connections, causing requests to block while waiting for a free connection.
This resulted in:
- Increased request latency
- Elevated error rates
- Trace spans showing prolonged database wait times

## Resolution

- Increased connection pool size from 2 to 20
- Added connection pool utilization metrics
- Documented database capacity thresholds


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
