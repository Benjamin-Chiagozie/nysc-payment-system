// ============================================================
// NYSC Payment Platform — Authentication Middleware
// Protects routes by verifying JWT tokens
// and enforcing Role-Based Access Control (RBAC)
// ============================================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const AppError = require('../utils/errorHandler');

// ── PROTECT MIDDLEWARE ────────────────────────────────────────
// Runs before any protected route handler
// Checks that the request carries a valid JWT token
const protect = async (req, res, next) => {
  try {
    // 1. Check if Authorization header exists
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided. Please log in.',
      });
    }

    // 2. Verify the token's signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    // 3. Check user still exists and is still active
    const result = await query(
      `SELECT id, full_name, email, role, state, is_active
       FROM users WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact the administrator.',
      });
    }

    // 4. Attach user to the request object
    // Every subsequent middleware and controller can access req.user
    req.user = user;
    next();

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
};

// ── RBAC MIDDLEWARE ───────────────────────────────────────────
// Restricts access to specific roles
// Usage: restrictTo('admin', 'finance_officer')
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of these roles: ${roles.join(', ')}. Your role is: ${req.user.role}.`,
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };