// db/pool.js
// -----------------------------------------------------------------------------
// Creates a MySQL connection pool using `mysql2`. This file does NOT create
// any tables — that's the job of `database/schema.sql`, which you run once
// (in MySQL Workbench, phpMyAdmin, or the mysql CLI) before starting the
// server. This keeps the schema itself as the single source of truth, which
// is what you want to be able to show/hand in for a DBMS project.
//
// EDIT ME: change these values to match your own MySQL setup, or set the
// equivalent environment variables (recommended if you ever deploy this
// somewhere other than your own machine).
// -----------------------------------------------------------------------------
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
 user: process.env.DB_USER || "lsms_user",
  password: process.env.DB_PASSWORD || "lsms_password",
  database: process.env.DB_NAME || "load_shedding_db",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // return DATE/DATETIME/TIME as plain strings, not JS Date objects
});

// Retryable transient MySQL error codes
const RETRYABLE_ERRORS = [
  "ER_LOCK_DEADLOCK",
  "ER_LOCK_WAIT_TIMEOUT",
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "ETIMEDOUT",
  "EPIPE",
];

/**
 * Execute a pool operation with exponential backoff retries for transient errors.
 */
async function executeWithRetry(fn, retries = 3, delayMs = 100) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
     } catch (err) {
      attempt++;
      if (attempt > retries || !RETRYABLE_ERRORS.includes(err.code)) {
        throw err;
      }
      console.warn(`[DB Pool Retry] Attempt ${attempt} failed with ${err.code}. Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }
}

/**
 * Execute a callback inside an isolated transaction with automatic commit/rollback.
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = pool;
module.exports.executeWithRetry = executeWithRetry;
module.exports.withTransaction = withTransaction;

