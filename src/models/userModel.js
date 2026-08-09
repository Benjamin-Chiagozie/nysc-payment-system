// ============================================================
// NYSC Payment Platform — User Model
// All database queries related to users live here
// Controllers never touch the database directly
// ============================================================

const { query } = require('../config/database');

// Find a user by their email address
const findByEmail = async (email) => {
  const result = await query(
    `SELECT id, full_name, email, password_hash,
            role, state, is_active, last_login_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

// Find a user by their ID
const findById = async (id) => {
  const result = await query(
    `SELECT id, full_name, email, role, state,
            is_active, last_login_at, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// Create a new user
const createUser = async ({ id, full_name, email, password_hash, role, state }) => {
  const result = await query(
    `INSERT INTO users
       (id, full_name, email, password_hash, role, state)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, full_name, email, role, state, created_at`,
    [id, full_name, email, password_hash, role, state || null]
  );
  return result.rows[0];
};

// Update last login timestamp
const updateLastLogin = async (id) => {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [id]
  );
};

// Get all users (admin only)
const getAllUsers = async () => {
  const result = await query(
    `SELECT id, full_name, email, role, state,
            is_active, last_login_at, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows;
};

module.exports = {
  findByEmail,
  findById,
  createUser,
  updateLastLogin,
  getAllUsers,
};