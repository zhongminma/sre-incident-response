const client = require("prom-client");

client.collectDefaultMetrics();

const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 3, 5],
});

function normalizeRoute(req) {
  return req.route?.path || req.path || "unknown";
}

function observeHttpRequest(req, res, startedAt) {
  const durationSeconds = (Date.now() - startedAt) / 1000;

  httpRequestDurationSeconds.observe(
    {
      method: req.method,
      route: normalizeRoute(req),
      status_code: String(res.statusCode),
    },
    durationSeconds
  );
}

module.exports = {
  metricsRegister: client.register,
  observeHttpRequest,
};
