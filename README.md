# SRE Incident Response & Observability Lab

This project simulates real production incidents and demonstrates how SRE teams investigate, identify root causes, and verify fixes with observability tools.

## Target Stack

- OpenTelemetry for instrumentation
- Prometheus for metrics
- Grafana for dashboards
- Jaeger for distributed tracing
- Kubernetes for deployment and incident simulation

## First Incident Scenario

**High Latency caused by Database Connection Pool Exhaustion**

Expected symptom:

```text
P95 latency: 300ms -> 2500ms
```

Investigation path:

```text
Grafana
  -> Prometheus
  -> Logs
  -> Jaeger traces
  -> Root cause analysis
```

Root cause:

```text
Database connection pool exhausted
```

Fix:

```text
Increase the database connection pool size based on expected concurrency and database capacity.
```

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
