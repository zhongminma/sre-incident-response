const express = require("express");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);
const simulatedDbWorkMs = Number(process.env.SIMULATED_DB_WORK_MS || 800);

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

app.listen(port, () => {
  console.log(`checkout-service listening on port ${port}`, {
    dbPoolSize: process.env.DB_POOL_SIZE || 2,
    dbPoolAcquireTimeoutMs: process.env.DB_POOL_ACQUIRE_TIMEOUT_MS || 3000,
    simulatedDbWorkMs,
  });
});
