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
docker compose up --build -d
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
- `HighCheckoutP95Latency` alert triggers when P95 stays above `2.5s`.
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
- `Alert Triggered: P95 Latency > 2.5s`
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

Alert firing state:

```promql
ALERTS{alertname="HighCheckoutP95Latency",alertstate="firing"}
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

## Detailed Test Manual

This section explains how to test the local Docker Compose version of the incident.

### Prerequisites

Before starting, confirm these tools are available:

```bash
docker --version
docker compose version
k6 version
```

If `k6` is not installed on macOS, install it with Homebrew:

```bash
brew install k6
```

Also make sure Docker Desktop is running and these local ports are free:

```text
3000  checkout-service
3001  Grafana
9090  Prometheus
16686 Jaeger
5432  Postgres
4318  OpenTelemetry HTTP receiver
```

The goal is to validate the full incident workflow:

```text
Start lab
  -> Verify services
  -> Trigger high latency
  -> Observe metrics, logs, and traces
  -> Apply fix
  -> Verify recovery
```

### 1. Start the Lab

From the project root:

```bash
cd /Users/kevinma/Documents/sre-incident-response
docker compose up --build -d
```

Check that all containers are running:

```bash
docker compose ps
```

Expected services:

```text
checkout-service
postgres
prometheus
grafana
jaeger
```

### 2. Verify the Checkout API

Health check:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"service":"checkout-service","status":"healthy"}
```

Checkout request:

```bash
curl http://localhost:3000/checkout
```

Expected response:

```json
{
  "status": "ok",
  "databaseTime": "...",
  "connectionWaitMs": 10,
  "simulatedDbWorkMs": 800,
  "latencyMs": 820
}
```

Metrics endpoint:

```bash
curl http://localhost:3000/metrics
```

Look for:

```text
http_request_duration_seconds
```

### 3. Verify Prometheus

Open Prometheus:

```text
http://localhost:9090
```

Check readiness:

```bash
curl http://localhost:9090/-/ready
```

Expected response:

```text
Prometheus Server is Ready.
```

Check target status:

```text
Status -> Targets
```

Expected target:

```text
checkout-service:3000
```

Expected state:

```text
UP
```

Run this PromQL query:

```promql
up
```

Expected result:

```text
checkout-service target value is 1
```

### 4. Verify Grafana

Open Grafana:

```text
http://localhost:3001
```

Default credentials:

```text
admin / admin
```

Open dashboard:

```text
SRE Lab / Checkout Latency Incident
```

Expected panels:

```text
Checkout P95 Latency
Alert Triggered: P95 Latency > 2.5s
Checkout Latency Percentiles
Checkout Request Rate
Checkout Error Rate
```

If the dashboard shows `No data`, generate one checkout request:

```bash
curl http://localhost:3000/checkout
```

Wait about 10 seconds, then refresh Grafana. The dashboard queries use `route="/checkout"`, so `/health` traffic alone is not enough to populate the panels.

### 5. Verify Jaeger

Open Jaeger:

```text
http://localhost:16686
```

Select service:

```text
checkout-service
```

Generate one checkout request if needed:

```bash
curl http://localhost:3000/checkout
```

Search for traces.

Expected operations:

```text
GET /checkout
pg-pool.connect
pg.query:SELECT checkout
```

### 6. Trigger the High Latency Incident

Confirm the checkout endpoint works before starting the load test:

```bash
curl http://localhost:3000/checkout
```

Run the high latency load test:

```bash
k6 run load/high-latency.js
```

The load test ramps traffic up to 30 virtual users.

The incident configuration is:

```text
DB_POOL_SIZE=2
DB_POOL_ACQUIRE_TIMEOUT_MS=3000
SIMULATED_DB_WORK_MS=800
```

Expected k6 signal:

```text
http_req_duration p95 increases to multiple seconds
some requests may return 503
```

During validation, one observed run produced:

```text
k6 p95 latency: 3.52s
Prometheus P95: ~4.88s
alert: HighCheckoutP95Latency firing
error rate: ~46.8%
```

### 7. Observe the Incident in Grafana

Open:

```text
http://localhost:3001
```

Dashboard:

```text
SRE Lab / Checkout Latency Incident
```

Watch:

```text
Checkout P95 Latency
Alert Triggered: P95 Latency > 2.5s
Checkout Latency Percentiles
Checkout Request Rate
Checkout Error Rate
```

Expected finding:

```text
P95 latency rises sharply during the load test.
The alert panel changes from OK to TRIGGERED after P95 stays above 2.5s for 30 seconds.
```

Use the `Last 15 minutes` time range and refresh the dashboard after k6 has been running for 10-20 seconds.

### 8. Observe the Incident in Prometheus

First confirm Prometheus has checkout samples:

```promql
http_request_duration_seconds_count{route="/checkout"}
```

If this query returns no series, run one checkout request or start the k6 load test, then wait for the next Prometheus scrape.

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

Alert state:

```promql
ALERTS{alertname="HighCheckoutP95Latency",alertstate="firing"}
```

You can also open:

```text
http://localhost:9090/alerts
```

Expected alert:

```text
HighCheckoutP95Latency
state: firing
```

Expected finding:

```text
Latency and error rate increase when concurrency exceeds the DB pool size.
```

### 9. Observe the Incident in Logs

Follow checkout-service logs:

```bash
docker compose logs -f checkout-service
```

Look for:

```text
checkout request waiting for database connection
checkout request acquired database connection
checkout request released database connection
checkout database operation failed
timeout exceeded when trying to connect
```

Expected finding:

```text
Requests wait for database connections and some requests time out.
```

### 10. Observe the Incident in Jaeger

Open:

```text
http://localhost:16686
```

Select service:

```text
checkout-service
```

Search for operation:

```text
GET /checkout
```

Expected trace spans:

```text
GET /checkout
pg-pool.connect
pg.connect
pg.query:SELECT checkout
```

Expected finding:

```text
The checkout request includes database connection and query spans.
```

### 11. Apply the Fix

Keep Prometheus and Grafana running so you can compare the incident and recovery on the same dashboard.

Recreate only the checkout service with the fixed profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.fixed.yml up --build -d --no-deps checkout-service
```

Do not run `docker compose down` before applying the fix. In this lab, `down` removes containers and can reset short-lived observability data, which makes before-and-after comparison harder.

The fixed profile changes:

```text
DB_POOL_SIZE=2 -> DB_POOL_SIZE=20
```

Confirm the service started with the fixed pool size:

```bash
docker compose logs checkout-service
```

Expected startup log:

```text
dbPoolSize: '20'
```

Prometheus target should stay `UP`:

```text
http://localhost:9090/targets
```

Grafana should keep the existing dashboard time series while new recovery samples arrive:

```text
http://localhost:3001
SRE Lab / Checkout Latency Incident
```

If you already ran `docker compose down`, start the fixed lab again:

```bash
docker compose -f docker-compose.yml -f docker-compose.fixed.yml up --build -d
```

Then generate fresh checkout traffic:

```bash
k6 run load/high-latency.js
```

### 12. Verify Recovery

Run the same k6 test again:

```bash
k6 run load/high-latency.js
```

Expected recovery signals:

```text
P95 latency is lower
HighCheckoutP95Latency alert returns to inactive
error rate is lower
fewer or no DB connection timeout logs
```

Check Grafana again:

```text
SRE Lab / Checkout Latency Incident
```

Compare before and after:

```text
incident profile: DB_POOL_SIZE=2
fixed profile: DB_POOL_SIZE=20
```

### 13. Clean Up

If you only want to pause the lab and keep container-local runtime data:

```bash
docker compose stop
```

Start it again later:

```bash
docker compose start
```

Stop and remove containers when you are finished with the lab:

```bash
docker compose down
```

The current Compose file keeps Grafana, Prometheus, and Postgres data in named Docker volumes, so `docker compose down` does not remove those volumes.

Remove volumes if you want a fresh database next time:

```bash
docker compose down -v
```

Warning: `docker compose down -v` deletes named volumes, including Grafana, Prometheus, and Postgres data.

### Troubleshooting

If Docker is not running:

```text
Start Docker Desktop and retry docker compose commands.
```

If Grafana dashboard is missing:

```bash
docker compose logs grafana
```

If Grafana shows `No data`:

```bash
curl http://localhost:3000/checkout
k6 run load/high-latency.js
```

Then wait 10-20 seconds and refresh Grafana with the time range set to `Last 15 minutes`.

Prometheus target `UP` only means Prometheus can scrape `/metrics`. It does not mean the incident has checkout traffic yet.

Confirm checkout metrics exist with:

```promql
http_request_duration_seconds_count{route="/checkout"}
```

If the alert does not trigger:

```text
Open http://localhost:9090/alerts and confirm HighCheckoutP95Latency is loaded.
Run k6 for at least 30 seconds after P95 goes above 2.5s.
Use the incident profile with DB_POOL_SIZE=2, not the fixed profile with DB_POOL_SIZE=20.
```

Confirm alert state with:

```promql
ALERTS{alertname="HighCheckoutP95Latency"}
```

If Prometheus target is down:

```bash
docker compose logs prometheus
docker compose logs checkout-service
```

If `k6` is not found:

```bash
brew install k6
k6 version
```

If Jaeger has no traces:

```bash
curl http://localhost:3000/checkout
docker compose logs checkout-service
```
