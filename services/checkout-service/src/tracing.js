const { NodeSDK } = require("@opentelemetry/sdk-node");
const { ConsoleSpanExporter } = require("@opentelemetry/sdk-trace-base");
const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");

const serviceName = process.env.OTEL_SERVICE_NAME || "checkout-service";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

const traceExporter = otlpEndpoint
  ? new OTLPTraceExporter({ url: otlpEndpoint })
  : new ConsoleSpanExporter();

const sdk = new NodeSDK({
  serviceName,
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": {
        enabled: false,
      },
    }),
  ],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .then(() => console.log("OpenTelemetry tracing shut down"))
    .catch((error) => console.error("OpenTelemetry tracing shutdown failed", error))
    .finally(() => process.exit(0));
});
