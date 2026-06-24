const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool
// A pool keeps multiple database connections open and ready
// so your app doesn't have to open a new connection for every request
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                // maximum 20 simultaneous connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test the connection when the app starts
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err.message);
  process.exit(-1);
});

// Helper function: run a query
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`Query executed in ${duration}ms | Rows: ${result.rowCount}`);
    return result;
  } catch (error) {
    console.error('Query error:', error.message);
    throw error;
  }
};

// Helper function: get a client for transactions
// Transactions are used when multiple queries must ALL succeed or ALL fail together
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };