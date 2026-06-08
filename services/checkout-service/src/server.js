const express = require("express");
const { pool } = require("./db");
const { metricsRegister, observeHttpRequest } = require("./metrics");

const app = express();
const port = Number(process.env.PORT || 3000);
const simulatedDbWorkMs = Number(process.env.SIMULATED_DB_WORK_MS || 800);
const memoryLeakChunkMb = Number(process.env.MEMORY_LEAK_CHUNK_MB || 10);
const maxMemoryLeakChunkMb = Number(process.env.MAX_MEMORY_LEAK_CHUNK_MB || 128);
const leakedMemoryChunks = [];

function getMemoryStatus() {
  const memoryUsage = process.memoryUsage();
  const leakedBytes = leakedMemoryChunks.reduce((total, chunk) => total + chunk.byteLength, 0);

  return {
    leakedChunks: leakedMemoryChunks.length,
    leakedBytes,
    leakedMb: Math.round((leakedBytes / 1024 / 1024) * 100) / 100,
    rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
    heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
    externalMb: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
  };
}

function getRequestedLeakMb(req) {
  const requestedMb = Number(req.query.mb || memoryLeakChunkMb);

  if (!Number.isFinite(requestedMb) || requestedMb <= 0) {
    return memoryLeakChunkMb;
  }

  return Math.min(Math.ceil(requestedMb), maxMemoryLeakChunkMb);
}

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (req.path !== "/metrics") {
      observeHttpRequest(req, res, startedAt);
    }
  });

  next();
});

app.get("/health", (req, res) => {
  res.status(200).json({
    service: "checkout-service",
    status: "healthy",
  });
});

app.get("/checkout", async (req, res) => {
  const startedAt = Date.now();
  let dbClient;

  try {
    console.log("checkout request waiting for database connection");
    dbClient = await pool.connect();

    const connectionAcquiredAt = Date.now();
    const connectionWaitMs = connectionAcquiredAt - startedAt;
    const simulatedDbWorkSeconds = simulatedDbWorkMs / 1000;

    console.log("checkout request acquired database connection", {
      connectionWaitMs,
    });

    const result = await dbClient.query(
      "SELECT NOW() AS database_time, pg_sleep($1)",
      [simulatedDbWorkSeconds]
    );

    res.status(200).json({
      status: "ok",
      databaseTime: result.rows[0].database_time,
      connectionWaitMs,
      simulatedDbWorkMs,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("checkout database operation failed", {
      message: error.message,
      latencyMs: Date.now() - startedAt,
    });

    res.status(503).json({
      status: "error",
      message: "checkout database unavailable",
    });
  } finally {
    if (dbClient) {
      dbClient.release();
      console.log("checkout request released database connection");
    }
  }
});

app.get("/memory-leak", (req, res) => {
  const leakMb = getRequestedLeakMb(req);
  const leakBytes = leakMb * 1024 * 1024;

  leakedMemoryChunks.push(Buffer.alloc(leakBytes, "x"));

  const memoryStatus = getMemoryStatus();

  console.warn("memory leak chunk retained", {
    leakMb,
    leakedChunks: memoryStatus.leakedChunks,
    leakedMb: memoryStatus.leakedMb,
    rssMb: memoryStatus.rssMb,
  });

  res.status(200).json({
    status: "leaked",
    leakMb,
    ...memoryStatus,
  });
});

app.get("/memory-status", (req, res) => {
  res.status(200).json({
    status: "ok",
    ...getMemoryStatus(),
  });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", metricsRegister.contentType);
  res.status(200).send(await metricsRegister.metrics());
});

app.listen(port, () => {
  console.log(`checkout-service listening on port ${port}`, {
    dbPoolSize: process.env.DB_POOL_SIZE || 2,
    dbPoolAcquireTimeoutMs: process.env.DB_POOL_ACQUIRE_TIMEOUT_MS || 3000,
    simulatedDbWorkMs,
    memoryLeakChunkMb,
    maxMemoryLeakChunkMb,
  });
});
