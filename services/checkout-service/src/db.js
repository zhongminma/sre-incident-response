const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "checkout",
  user: process.env.DB_USER || "checkout",
  password: process.env.DB_PASSWORD || "checkout",
  max: Number(process.env.DB_POOL_SIZE || 2),
  connectionTimeoutMillis: Number(process.env.DB_POOL_ACQUIRE_TIMEOUT_MS || 3000),
});

module.exports = { pool };
