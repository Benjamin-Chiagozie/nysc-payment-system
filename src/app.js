const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Security Middleware ──────────────────────────────────────────────
// helmet adds security headers to every response
app.use(helmet());

// cors allows the frontend to communicate with this backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting: max 100 requests per 15 minutes per IP address
// This prevents brute-force attacks on the login endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.',
  },
});
app.use('/api/', limiter);

// ── Body Parsing ─────────────────────────────────────────────────────
// These lines allow your app to read JSON data sent in request bodies
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const corpsMemberRoutes = require('./routes/corpsMemberRoutes');
const validationRoutes = require('./routes/validationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/corps-members', corpsMemberRoutes);
app.use('/api/validation', validationRoutes);

// ── Health Check Route ───────────────────────────────────────────────
// This is a simple route to confirm your server is running
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NYSC Payment Disbursement System API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ──────────────────────────────────────────────────────
// If a request hits a route that doesn't exist, return this
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ─────────────────────────────────────────────
// If any part of the app throws an error, this catches it
app.use((err, req, res, next) => {
  console.error('Global error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;