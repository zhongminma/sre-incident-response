# Incident: High Latency Caused by Database Connection Pool Exhaustion

## Scenario

The checkout API becomes slow when traffic increases.

Expected symptom:

```text
P95 latency: 300ms -> 2500ms
```

The service is still running, but many requests spend time waiting for an available database connection.

## Lab Setup

The incident is simulated with these environment variables:

```text
DB_POOL_SIZE=2
DB_POOL_ACQUIRE_TIMEOUT_MS=3000
SIMULATED_DB_WORK_MS=800
```

This means only two checkout requests can hold a database connection at the same time. When more concurrent requests arrive, they queue in the application while waiting for a connection.

## How to Trigger

Start the lab:

```bash
docker compose up --build
```

Run the high latency load test:

```bash
k6 run load/high-latency.js
```

Open Grafana:

```text
http://localhost:3001
```

Default credentials:

```text
admin / admin
```

Dashboard:

```text
SRE Lab / Checkout Latency Incident
```

## Symptoms

Expected visible signals:

- Checkout P95 latency increases.
- Request rate remains stable during the load test.
- Some requests may return `503` if connection acquisition times out.
- Logs show requests waiting for and acquiring database connections.

Example application logs:

```text
checkout request waiting for database connection
checkout request acquired database connection
checkout request released database connection
checkout database operation failed
```

## Investigation Flow

### 1. Grafana

Start with the `Checkout Latency Incident` dashboard.

Check:

- `Checkout P95 Latency`
- `Checkout Latency Percentiles`
- `Checkout Request Rate`
- `Checkout Error Rate`

Initial conclusion:

```text
Checkout requests are slow under load.
```

### 2. Prometheus

Confirm the latency increase with PromQL.

P95 latency:

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

Error rate:

```promql
sum(rate(http_request_duration_seconds_count{route="/checkout",status_code=~"5.."}[5m]))
/
sum(rate(http_request_duration_seconds_count{route="/checkout"}[5m]))
```

Expected finding:

```text
Latency increases sharply when concurrency exceeds the available database connections.
```

### 3. Logs

Inspect checkout-service logs:

```bash
docker compose logs -f checkout-service
```

Look for:

```text
waiting for database connection
acquired database connection
released database connection
database operation failed
```

Expected finding:

```text
Requests wait before they can acquire a database connection.
```

### 4. Root Cause

The checkout service database connection pool is too small for the current request concurrency.

Current incident configuration:

```text
DB_POOL_SIZE=2
```

Each checkout request holds a database connection while simulated database work runs:

```text
SIMULATED_DB_WORK_MS=800
```

When the load test sends more concurrent requests than the pool can handle, requests queue while waiting for a connection. This increases tail latency and can eventually cause connection acquisition timeouts.

## Fix

Increase the database connection pool size based on expected concurrency and database capacity.

Example fix:

```text
DB_POOL_SIZE=20
```

Important note:

```text
The pool size should not be increased blindly. It must fit the database capacity.
```

If the pool is too small, the application queues requests. If the pool is too large, the database may become saturated.

## Verification

After increasing the pool size:

1. Restart the checkout service.
2. Run the same k6 load test.
3. Check the Grafana dashboard.
4. Compare P95 latency before and after the change.
5. Confirm error rate returns to normal.
6. Confirm logs no longer show connection acquisition failures.

Expected recovery:

```text
P95 latency returns closer to the normal baseline.
```

## Prevention

Recommended follow-up actions:

- Add alerting for high P95 latency.
- Track database connection wait time as a dedicated metric.
- Add a dashboard panel for pool size and active connections.
- Load test checkout before production releases.
- Tune database pool size based on traffic and database capacity.
