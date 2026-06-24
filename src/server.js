const app = require('./app');
const { pool } = require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

// Start the server
const server = app.listen(PORT, async () => {
  console.log('================================================');
  console.log('  NYSC Payment Disbursement System');
  console.log('================================================');
  console.log(`  Server running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log('================================================');

  // Test database connection on startup
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`  Database connected at: ${result.rows[0].now}`);
    console.log('================================================');
  } catch (error) {
    console.error('  ❌ Database connection failed:', error.message);
    process.exit(1);
  }
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    process.exit(1);
  }
});

// Graceful shutdown
// When you stop the server (Ctrl+C), close database connections cleanly
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    pool.end(() => {
      console.log('Database pool closed.');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  server.close(() => {
    pool.end(() => {
      console.log('Database pool closed.');
      process.exit(0);
    });
  });
});