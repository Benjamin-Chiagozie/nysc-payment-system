// ============================================================
// NYSC Payment Platform — Tracking Controller
// Real-time payment status tracking for corps members
// and payment analytics for administrators
// ============================================================

const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

// ── GET PAYMENT STATUS BY STATE CODE ─────────────────────────
// GET /api/tracking/status/:stateCode
// Corps members use this to check their payment status
const getPaymentStatusByStateCode = async (req, res) => {
  try {
    const stateCode = req.params.stateCode.toUpperCase();

    // Get corps member details
    const memberResult = await query(
      `SELECT
         id, state_code, full_name,
         deployment_state, deployment_lga,
         bank_name, account_validated
       FROM corps_members
       WHERE state_code = $1`,
      [stateCode]
    );

    if (memberResult.rows.length === 0) {
      return sendError(res, 404, 'No corps member found with that state code.');
    }

    const member = memberResult.rows[0];

    // Get all payments for this member
    const paymentsResult = await query(
      `SELECT
         p.id,
         p.payment_month,
         p.amount,
         p.status,
         p.retry_count,
         p.failure_reason,
         p.paystack_reference,
         p.initiated_at,
         p.completed_at,
         pb.batch_label
       FROM payments p
       LEFT JOIN payment_batches pb ON pb.id = p.batch_id
       WHERE p.corps_member_id = $1
       ORDER BY p.payment_month DESC`,
      [member.id]
    );

    // Get current month clearance status
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStr = currentMonth.toISOString().split('T')[0];

    const clearanceResult = await query(
      `SELECT status, clearance_month,
              attendance_confirmed, cds_confirmed
       FROM clearances
       WHERE corps_member_id = $1
         AND clearance_month = $2`,
      [member.id, monthStr]
    );

    // Build payment status summary
    const payments = paymentsResult.rows;
    const totalPaid = payments
      .filter(p => p.status === 'success')
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    return sendSuccess(res, 200, 'Payment status retrieved.', {
      member: {
        state_code: member.state_code,
        full_name: member.full_name,
        deployment_state: member.deployment_state,
        deployment_lga: member.deployment_lga,
        bank_name: member.bank_name,
        account_validated: member.account_validated,
      },
      current_clearance: clearanceResult.rows[0] || null,
      payment_summary: {
        total_payments: payments.length,
        successful: payments.filter(p => p.status === 'success').length,
        failed: payments.filter(p => p.status === 'failed').length,
        pending: payments.filter(p => p.status === 'pending').length,
        total_amount_received: totalPaid,
      },
      payment_history: payments,
    });

  } catch (error) {
    console.error('GetPaymentStatus error:', error.message);
    return sendError(res, 500, 'Could not retrieve payment status.');
  }
};

// ── GET LIVE PAYMENT ANALYTICS ────────────────────────────────
// GET /api/tracking/analytics
// Admin dashboard — real-time disbursement statistics
const getPaymentAnalytics = async (req, res) => {
  try {
    // Overall payment statistics
    const overallStats = await query(`
      SELECT
        COUNT(*)                                        AS total_payments,
        COUNT(*) FILTER (WHERE status = 'success')     AS successful,
        COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
        COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE status = 'processing')  AS processing,
        COUNT(*) FILTER (WHERE status = 'reversed')    AS reversed,
        COALESCE(SUM(amount) FILTER
          (WHERE status = 'success'), 0)               AS total_disbursed,
        COALESCE(AVG(retry_count), 0)                  AS avg_retry_count
      FROM payments
    `);

    // Batch statistics
    const batchStats = await query(`
      SELECT
        COUNT(*)                                          AS total_batches,
        COUNT(*) FILTER (WHERE status = 'completed')     AS completed_batches,
        COUNT(*) FILTER (WHERE status = 'processing')    AS active_batches,
        COUNT(*) FILTER (WHERE status = 'failed')        AS failed_batches,
        COALESCE(SUM(total_amount), 0)                   AS total_batch_amount
      FROM payment_batches
    `);

    // Payment status breakdown by state
    const stateBreakdown = await query(`
      SELECT
        cm.deployment_state,
        COUNT(p.id)                                      AS total,
        COUNT(p.id) FILTER (WHERE p.status = 'success') AS successful,
        COUNT(p.id) FILTER (WHERE p.status = 'failed')  AS failed,
        COALESCE(SUM(p.amount)
          FILTER (WHERE p.status = 'success'), 0)        AS amount_disbursed
      FROM corps_members cm
      LEFT JOIN payments p ON p.corps_member_id = cm.id
      GROUP BY cm.deployment_state
      ORDER BY amount_disbursed DESC
    `);

    // Recent payment activity (last 10 events)
    const recentActivity = await query(`
      SELECT
        p.status,
        p.amount,
        p.initiated_at,
        p.completed_at,
        cm.state_code,
        cm.full_name,
        cm.deployment_state
      FROM payments p
      INNER JOIN corps_members cm ON cm.id = p.corps_member_id
      ORDER BY p.initiated_at DESC
      LIMIT 10
    `);

    return sendSuccess(res, 200, 'Payment analytics retrieved.', {
      overview: overallStats.rows[0],
      batches: batchStats.rows[0],
      by_state: stateBreakdown.rows,
      recent_activity: recentActivity.rows,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('GetPaymentAnalytics error:', error.message);
    return sendError(res, 500, 'Could not retrieve payment analytics.');
  }
};

// ── GET FAILED PAYMENTS REPORT ────────────────────────────────
// GET /api/tracking/failed-payments
// Lists all failed payments with reasons for admin review
const getFailedPaymentsReport = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.payment_month,
        p.amount,
        p.status,
        p.retry_count,
        p.failure_reason,
        p.initiated_at,
        cm.state_code,
        cm.full_name,
        cm.deployment_state,
        cm.bank_name,
        cm.account_number,
        pb.batch_label
      FROM payments p
      INNER JOIN corps_members cm ON cm.id = p.corps_member_id
      LEFT JOIN payment_batches pb ON pb.id = p.batch_id
      WHERE p.status = 'failed'
      ORDER BY p.retry_count DESC, p.initiated_at DESC
    `);

    return sendSuccess(res, 200, `${result.rows.length} failed payments found.`, {
      count: result.rows.length,
      failed_payments: result.rows,
    });

  } catch (error) {
    console.error('GetFailedPayments error:', error.message);
    return sendError(res, 500, 'Could not retrieve failed payments report.');
  }
};

// ── GET CLEARANCE STATUS OVERVIEW ────────────────────────────
// GET /api/tracking/clearances
// Shows clearance completion rates for current month
const getClearanceOverview = async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStr = currentMonth.toISOString().split('T')[0];

    const result = await query(`
      SELECT
        COUNT(*)                                           AS total_members,
        COUNT(c.id)                                        AS have_clearance,
        COUNT(c.id) FILTER
          (WHERE c.status = 'approved')                   AS approved,
        COUNT(c.id) FILTER
          (WHERE c.status = 'pending')                    AS pending,
        COUNT(c.id) FILTER
          (WHERE c.status = 'rejected')                   AS rejected,
        COUNT(cm.id) FILTER
          (WHERE c.id IS NULL)                            AS no_clearance,
        ROUND(COUNT(c.id) FILTER
          (WHERE c.status = 'approved') * 100.0
          / NULLIF(COUNT(*), 0), 2)                       AS approval_rate
      FROM corps_members cm
      LEFT JOIN clearances c
        ON c.corps_member_id = cm.id
        AND c.clearance_month = $1
      WHERE cm.is_active = TRUE
    `, [monthStr]);

    // Breakdown by state
    const byState = await query(`
      SELECT
        cm.deployment_state,
        COUNT(*)                                           AS total,
        COUNT(c.id) FILTER
          (WHERE c.status = 'approved')                   AS approved,
        COUNT(c.id) FILTER
          (WHERE c.status = 'pending')                    AS pending,
        COUNT(cm.id) FILTER
          (WHERE c.id IS NULL)                            AS no_clearance
      FROM corps_members cm
      LEFT JOIN clearances c
        ON c.corps_member_id = cm.id
        AND c.clearance_month = $1
      WHERE cm.is_active = TRUE
      GROUP BY cm.deployment_state
      ORDER BY approved DESC
    `, [monthStr]);

    return sendSuccess(res, 200, 'Clearance overview retrieved.', {
      month: monthStr,
      overview: result.rows[0],
      by_state: byState.rows,
    });

  } catch (error) {
    console.error('GetClearanceOverview error:', error.message);
    return sendError(res, 500, 'Could not retrieve clearance overview.');
  }
};

module.exports = {
  getPaymentStatusByStateCode,
  getPaymentAnalytics,
  getFailedPaymentsReport,
  getClearanceOverview,
};