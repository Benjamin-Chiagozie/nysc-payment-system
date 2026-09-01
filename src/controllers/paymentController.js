// ============================================================
// NYSC Payment Platform — Payment Controller
// ============================================================

const { query } = require('../config/database');
const { requestOTP, verifyOTP } = require('../services/otpService');
const {
  createPaymentBatch,
  dispatchPaymentBatch,
  retryFailedPayments,
  getEligibleMembers,
} = require('../services/paymentEngine');
const { sendSuccess, sendError } = require('../utils/response');
const { createAuditLog } = require('../models/auditModel');

// ── STEP 1: REQUEST OTP ───────────────────────────────────────
// POST /api/payments/request-otp
const requestPaymentOTP = async (req, res) => {
  try {
    const result = await requestOTP(req.user);
    return sendSuccess(res, 200, result.message, {
      ...(process.env.NODE_ENV === 'development' && {
        dev_otp: result.dev_otp,
      }),
    });
  } catch (error) {
    console.error('RequestOTP error:', error.message);
    return sendError(res, 500, 'Could not generate OTP. Please try again.');
  }
};

// ── STEP 2: INITIATE BATCH WITH OTP ──────────────────────────
// POST /api/payments/initiate-batch
// Body: { payment_month: "2026-09-01", otp_code: "123456" }
const initiatePaymentBatch = async (req, res) => {
  try {
    const { payment_month, otp_code } = req.body;

    if (!payment_month || !otp_code) {
      return sendError(res, 400, 'payment_month and otp_code are required.');
    }

    // Verify OTP first — blocks dispatch if invalid
    const otpResult = await verifyOTP(req.user.id, otp_code);
    if (!otpResult.valid) {
      await createAuditLog({
        actor_id: req.user.id,
        actor_type: 'user',
        action: 'PAYMENT_BATCH_BLOCKED_INVALID_OTP',
        entity_type: 'payment_batch',
        details: { reason: otpResult.reason, payment_month },
      });
      return sendError(res, 401, `OTP verification failed: ${otpResult.reason}`);
    }

    // Create the batch
    const batchResult = await createPaymentBatch(payment_month, req.user.id);
    if (!batchResult.success) {
      return sendError(res, 400, batchResult.message);
    }

    // Dispatch asynchronously — API responds immediately
    dispatchPaymentBatch(batchResult.batch.id, req.user.id)
      .then((result) => console.log('Batch dispatch completed:', result))
      .catch((error) => console.error('Batch dispatch error:', error.message));

    return sendSuccess(
      res, 202,
      `Payment batch created and dispatch initiated for ${batchResult.total_members} corps members. Total: ₦${batchResult.total_amount.toLocaleString()}`,
      {
        batch_id: batchResult.batch.id,
        batch_label: batchResult.batch.batch_label,
        total_members: batchResult.total_members,
        total_amount: batchResult.total_amount,
        status: 'processing',
      }
    );

  } catch (error) {
    console.error('InitiateBatch error:', error.message);
    return sendError(res, 500, 'Could not initiate payment batch.');
  }
};

// ── GET ALL BATCHES ───────────────────────────────────────────
const getAllBatches = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         pb.*,
         u.full_name AS created_by_name,
         (SELECT COUNT(*) FROM payments p
          WHERE p.batch_id = pb.id) AS total_payments,
         (SELECT COUNT(*) FROM payments p
          WHERE p.batch_id = pb.id
            AND p.status = 'success') AS successful_payments,
         (SELECT COUNT(*) FROM payments p
          WHERE p.batch_id = pb.id
            AND p.status = 'failed') AS failed_payments,
         (SELECT COUNT(*) FROM payments p
          WHERE p.batch_id = pb.id
            AND p.status = 'pending') AS pending_payments
       FROM payment_batches pb
       LEFT JOIN users u ON u.id = pb.created_by
       ORDER BY pb.created_at DESC`
    );
    return sendSuccess(res, 200, 'Payment batches retrieved.', {
      count: result.rows.length,
      batches: result.rows,
    });
  } catch (error) {
    console.error('GetAllBatches error:', error.message);
    return sendError(res, 500, 'Could not retrieve payment batches.');
  }
};

// ── GET SINGLE BATCH ──────────────────────────────────────────
const getBatchById = async (req, res) => {
  try {
    const batchResult = await query(
      `SELECT pb.*, u.full_name AS created_by_name
       FROM payment_batches pb
       LEFT JOIN users u ON u.id = pb.created_by
       WHERE pb.id = $1`,
      [req.params.id]
    );

    if (batchResult.rows.length === 0) {
      return sendError(res, 404, 'Payment batch not found.');
    }

    const paymentsResult = await query(
      `SELECT p.*, cm.state_code, cm.full_name, cm.bank_name
       FROM payments p
       INNER JOIN corps_members cm ON cm.id = p.corps_member_id
       WHERE p.batch_id = $1
       ORDER BY p.initiated_at DESC`,
      [req.params.id]
    );

    return sendSuccess(res, 200, 'Batch details retrieved.', {
      batch: batchResult.rows[0],
      payments: paymentsResult.rows,
      summary: {
        total: paymentsResult.rows.length,
        success: paymentsResult.rows.filter(p => p.status === 'success').length,
        failed: paymentsResult.rows.filter(p => p.status === 'failed').length,
        pending: paymentsResult.rows.filter(p => p.status === 'pending').length,
      },
    });
  } catch (error) {
    console.error('GetBatchById error:', error.message);
    return sendError(res, 500, 'Could not retrieve batch details.');
  }
};

// ── GET ELIGIBLE MEMBERS ──────────────────────────────────────
const getEligible = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) {
      return sendError(res, 400, 'month query parameter is required (e.g. ?month=2026-09-01)');
    }
    const members = await getEligibleMembers(month);
    return sendSuccess(res, 200, `${members.length} eligible members found.`, {
      count: members.length,
      total_amount: members.length * (parseFloat(process.env.ALLOWANCE_AMOUNT) || 77000),
      members,
    });
  } catch (error) {
    console.error('GetEligible error:', error.message);
    return sendError(res, 500, 'Could not retrieve eligible members.');
  }
};

// ── RETRY FAILED PAYMENTS ─────────────────────────────────────
const retryFailed = async (req, res) => {
  try {
    const result = await retryFailedPayments(req.params.id, req.user.id);
    return sendSuccess(res, 200, result.message, { retried: result.retried });
  } catch (error) {
    console.error('RetryFailed error:', error.message);
    return sendError(res, 500, 'Could not retry failed payments.');
  }
};

// ── GET CORPS MEMBER PAYMENT STATUS ──────────────────────────
const getMyPaymentStatus = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         p.payment_month, p.amount, p.status,
         p.initiated_at, p.completed_at,
         p.paystack_reference, p.failure_reason,
         p.retry_count
       FROM payments p
       INNER JOIN corps_members cm ON cm.id = p.corps_member_id
       WHERE cm.state_code = $1
       ORDER BY p.payment_month DESC
       LIMIT 12`,
      [req.params.stateCode.toUpperCase()]
    );
    return sendSuccess(res, 200, 'Payment history retrieved.', {
      state_code: req.params.stateCode.toUpperCase(),
      payments: result.rows,
    });
  } catch (error) {
    console.error('GetMyPaymentStatus error:', error.message);
    return sendError(res, 500, 'Could not retrieve payment status.');
  }
};

module.exports = {
  requestPaymentOTP,
  initiatePaymentBatch,
  getAllBatches,
  getBatchById,
  getEligible,
  retryFailed,
  getMyPaymentStatus,
};