// ============================================================
// NYSC Payment Platform — Auth Routes
// Defines all authentication API endpoints
// ============================================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
  register,
  login,
  getMe,
  logout,
  getAllUsers,
} = require('../controllers/authController');

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validateLogin, validateRegister } = require('../validators/authValidator');

// Strict rate limiter specifically for login
// Max 5 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── PUBLIC ROUTES (no token required) ─────────────────────────
router.post('/login', loginLimiter, validateLogin, login);

// ── PROTECTED ROUTES (valid token required) ───────────────────
router.get('/me', protect, getMe);
router.post('/logout', protect, logout);

// ── ADMIN ONLY ROUTES ─────────────────────────────────────────
router.post(
  '/register',
  protect,
  restrictTo('admin'),
  validateRegister,
  register
);

router.get(
  '/users',
  protect,
  restrictTo('admin'),
  getAllUsers
);

module.exports = router;