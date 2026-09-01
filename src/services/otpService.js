// ============================================================
// NYSC Payment Platform — OTP Service
// Generates, stores, and verifies One-Time Passwords
// Required before any payment batch can be dispatched
// ============================================================

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { sendOTPEmail } = require('./emailService');
const { createAuditLog } = require('../models/auditModel');

const generateOTPCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ── REQUEST OTP ───────────────────────────────────────────────
const requestOTP = async (user) => {
  try {
    const otp_code = generateOTPCode();
    const expires_minutes = parseInt(process.env.OTP_EXPIRES_MINUTES) || 10;
    const expires_at = new Date(Date.now() + expires_minutes * 60 * 1000);

    // Invalidate any existing unused OTPs for this user
    await query(
      `UPDATE otp_codes
       SET is_used = TRUE
       WHERE user_id = $1
         AND is_used = FALSE
         AND purpose = 'payment_batch'`,
      [user.id]
    );

    // Save new OTP to database
    await query(
      `INSERT INTO otp_codes
         (id, user_id, code, purpose, expires_at)
       VALUES ($1, $2, $3, 'payment_batch', $4)`,
      [uuidv4(), user.id, otp_code, expires_at]
    );

    // Send OTP via email
    const emailResult = await sendOTPEmail({
      to: user.email,
      full_name: user.full_name,
      otp_code,
      expires_minutes,
    });

    // Audit log
    await createAuditLog({
      actor_id: user.id,
      actor_type: 'user',
      action: 'OTP_REQUESTED',
      entity_type: 'user',
      entity_id: user.id,
      details: {
        purpose: 'payment_batch',
        email_sent: emailResult.success,
        expires_at: expires_at.toISOString(),
      },
    });

    return {
      success: true,
      message: `OTP sent to ${user.email}. Valid for ${expires_minutes} minutes.`,
      // Show OTP in development mode for testing without email
      ...(process.env.NODE_ENV === 'development' && {
        dev_otp: otp_code,
      }),
    };

  } catch (error) {
    console.error('OTP request error:', error.message);
    throw error;
  }
};

// ── VERIFY OTP ────────────────────────────────────────────────
const verifyOTP = async (user_id, provided_code) => {
  try {
    const result = await query(
      `SELECT id, code, expires_at, is_used
       FROM otp_codes
       WHERE user_id = $1
         AND purpose = 'payment_batch'
         AND is_used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        reason: 'No active OTP found. Please request a new OTP.',
      };
    }

    const otp = result.rows[0];

    // Check if expired
    if (new Date() > new Date(otp.expires_at)) {
      return {
        valid: false,
        reason: 'OTP has expired. Please request a new one.',
      };
    }

    // Check if code matches
    if (otp.code !== provided_code.toString()) {
      await createAuditLog({
        actor_id: user_id,
        actor_type: 'user',
        action: 'OTP_FAILED',
        entity_type: 'user',
        entity_id: user_id,
        details: { reason: 'incorrect_code' },
      });
      return {
        valid: false,
        reason: 'Incorrect OTP. Please check and try again.',
      };
    }

    // Mark OTP as used — can never be used again
    await query(
      `UPDATE otp_codes SET is_used = TRUE WHERE id = $1`,
      [otp.id]
    );

    await createAuditLog({
      actor_id: user_id,
      actor_type: 'user',
      action: 'OTP_VERIFIED',
      entity_type: 'user',
      entity_id: user_id,
      details: { purpose: 'payment_batch' },
    });

    return { valid: true };

  } catch (error) {
    console.error('OTP verification error:', error.message);
    throw error;
  }
};

module.exports = { requestOTP, verifyOTP };