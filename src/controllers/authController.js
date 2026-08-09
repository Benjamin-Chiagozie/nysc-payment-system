// ============================================================
// NYSC Payment Platform — Auth Controller
// Handles login, register, getCurrentUser, logout
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const userModel = require('../models/userModel');
const { createAuditLog } = require('../models/auditModel');
const { sendSuccess, sendError } = require('../utils/response');

// ── Generate JWT Token ────────────────────────────────────────
const signToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      state: user.state,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// ── REGISTER ──────────────────────────────────────────────────
// POST /api/auth/register
// Admin only — creates new system user accounts
const register = async (req, res) => {
  try {
    const { full_name, email, password, role, state } = req.body;

    // 1. Check if email already exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return sendError(res, 409, 'An account with this email already exists.');
    }

    // 2. Hash the password
    // bcrypt cost factor of 12 means it does 2^12 = 4096 hashing rounds
    // making brute-force attacks extremely slow
    const password_hash = await bcrypt.hash(password, 12);

    // 3. Create the user
    const newUser = await userModel.createUser({
      id: uuidv4(),
      full_name,
      email,
      password_hash,
      role,
      state: state || null,
    });

    // 4. Record in audit log
    await createAuditLog({
      actor_id: req.user?.id || null,
      actor_type: 'user',
      action: 'USER_REGISTERED',
      entity_type: 'user',
      entity_id: newUser.id,
      details: { email, role, full_name },
      ip_address: req.ip,
    });

    return sendSuccess(res, 201, 'User account created successfully.', {
      user: newUser,
    });

  } catch (error) {
    console.error('Register error:', error.message);
    return sendError(res, 500, 'Registration failed. Please try again.');
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
// POST /api/auth/login
// Returns a JWT token on successful authentication
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const user = await userModel.findByEmail(email);
    if (!user) {
      // Use a generic message — don't reveal whether email exists
      return sendError(res, 401, 'Invalid email or password.');
    }

    // 2. Check if account is active
    if (!user.is_active) {
      return sendError(res, 401, 'Your account has been deactivated. Contact the administrator.');
    }

    // 3. Compare password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Record failed login attempt in audit log
      await createAuditLog({
        actor_id: null,
        actor_type: 'system',
        action: 'LOGIN_FAILED',
        entity_type: 'user',
        entity_id: user.id,
        details: { email, reason: 'incorrect_password' },
        ip_address: req.ip,
      });
      return sendError(res, 401, 'Invalid email or password.');
    }

    // 4. Update last login timestamp
    await userModel.updateLastLogin(user.id);

    // 5. Generate JWT token
    const token = signToken(user);

    // 6. Record successful login in audit log
    await createAuditLog({
      actor_id: user.id,
      actor_type: 'user',
      action: 'LOGIN_SUCCESS',
      entity_type: 'user',
      entity_id: user.id,
      details: { email, role: user.role },
      ip_address: req.ip,
    });

    return sendSuccess(res, 200, 'Login successful.', {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        state: user.state,
      },
    });

  } catch (error) {
    console.error('Login error:', error.message);
    return sendError(res, 500, 'Login failed. Please try again.');
  }
};

// ── GET CURRENT USER ──────────────────────────────────────────
// GET /api/auth/me
// Returns the currently logged-in user's profile
// Requires a valid JWT token
const getMe = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }
    return sendSuccess(res, 200, 'User profile retrieved.', { user });
  } catch (error) {
    console.error('GetMe error:', error.message);
    return sendError(res, 500, 'Could not retrieve user profile.');
  }
};

// ── LOGOUT ───────────────────────────────────────────────────
// POST /api/auth/logout
// JWT is stateless so logout is handled client-side
// We record it in the audit log for accountability
const logout = async (req, res) => {
  try {
    await createAuditLog({
      actor_id: req.user.id,
      actor_type: 'user',
      action: 'LOGOUT',
      entity_type: 'user',
      entity_id: req.user.id,
      details: { email: req.user.email },
      ip_address: req.ip,
    });
    return sendSuccess(res, 200, 'Logged out successfully.');
  } catch (error) {
    return sendError(res, 500, 'Logout failed.');
  }
};

// ── GET ALL USERS (Admin only) ────────────────────────────────
// GET /api/auth/users
const getAllUsers = async (req, res) => {
  try {
    const users = await userModel.getAllUsers();
    return sendSuccess(res, 200, 'Users retrieved successfully.', {
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('GetAllUsers error:', error.message);
    return sendError(res, 500, 'Could not retrieve users.');
  }
};

module.exports = { register, login, getMe, logout, getAllUsers };