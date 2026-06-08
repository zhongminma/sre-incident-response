const express = require("express");
const { pool } = require("./db");

const app = express();
const port = Number(process.env.PORT || 3000);

app.get("/health", (req, res) => {
  res.status(200).json({
    service: "checkout-service",
    status: "healthy",
  });
});

app.get("/checkout", async (req, res) => {
  const startedAt = Date.now();

  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.status(200).json({
      status: "ok",
      databaseTime: result.rows[0].database_time,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("checkout database query failed", {
      message: error.message,
      latencyMs: Date.now() - startedAt,
    });

    res.status(503).json({
      status: "error",
      message: "checkout database unavailable",
    });
  }
});

app.listen(port, () => {
  console.log(`checkout-service listening on port ${port}`);
});
