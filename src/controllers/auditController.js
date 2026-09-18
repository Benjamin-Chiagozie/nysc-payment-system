// ============================================================
// NYSC Payment Platform — Audit Controller
// Provides access to the immutable audit log and the
// complete system health dashboard
// ============================================================

const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

// ── GET AUDIT LOGS ────────────────────────────────────────────
// GET /api/audit/logs
// Supports filtering by action, actor_type, entity_type, date
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      actor_type,
      entity_type,
      from_date,
      to_date,
    } = req.query;

    let conditions = [];
    let values = [];
    let idx = 1;

    if (action) {
      conditions.push(`al.action ILIKE $${idx++}`);
      values.push(`%${action}%`);
    }
    if (actor_type) {
      conditions.push(`al.actor_type = $${idx++}`);
      values.push(actor_type);
    }
    if (entity_type) {
      conditions.push(`al.entity_type = $${idx++}`);
      values.push(entity_type);
    }
    if (from_date) {
      conditions.push(`al.created_at >= $${idx++}`);
      values.push(from_date);
    }
    if (to_date) {
      conditions.push(`al.created_at <= $${idx++}`);
      values.push(to_date);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`, values
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * limit;
    values.push(limit);
    values.push(offset);

    const result = await query(
      `SELECT
         al.id, al.actor_type, al.action,
         al.entity_type, al.entity_id,
         al.details, al.ip_address, al.created_at,
         u.full_name AS actor_name,
         u.email    AS actor_email,
         u.role     AS actor_role
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );

    return sendSuccess(res, 200, `${total} audit log entries found.`, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      total_pages: Math.ceil(total / limit),
      logs: result.rows,
    });

  } catch (error) {
    console.error('GetAuditLogs error:', error.message);
    return sendError(res, 500, 'Could not retrieve audit logs.');
  }
};

// ── GET AUDIT LOGS BY ENTITY ──────────────────────────────────
// GET /api/audit/entity/:entityId
// Returns the complete audit trail for one specific record
const getAuditLogsByEntity = async (req, res) => {
  try {
    const result = await query(
      `SELECT
         al.id, al.actor_type, al.action,
         al.entity_type, al.details,
         al.ip_address, al.created_at,
         u.full_name AS actor_name,
         u.role      AS actor_role
       FROM audit_logs al
       LEFT JOIN users u ON al.actor_id = u.id
       WHERE al.entity_id = $1
       ORDER BY al.created_at ASC`,
      [req.params.entityId]
    );

    return sendSuccess(
      res, 200,
      `${result.rows.length} audit events found for this record.`,
      { logs: result.rows }
    );
  } catch (error) {
    console.error('GetAuditLogsByEntity error:', error.message);
    return sendError(res, 500, 'Could not retrieve audit logs.');
  }
};

// ── GET SYSTEM HEALTH DASHBOARD ───────────────────────────────
// GET /api/audit/dashboard
// Complete system overview for administrators
const getSystemDashboard = async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    const monthStr = currentMonth.toISOString().split('T')[0];

    const [memberStats, paymentStats, batchStats,
           clearanceStats, auditStats, userStats, recentEvents] =
      await Promise.all([

        query(`SELECT
          COUNT(*)                                          AS total_members,
          COUNT(*) FILTER (WHERE is_active = TRUE)         AS active_members,
          COUNT(*) FILTER (WHERE is_active = FALSE)        AS inactive_members,
          COUNT(*) FILTER (WHERE account_validated = TRUE) AS validated_accounts,
          COUNT(*) FILTER (WHERE account_validated = FALSE
                           AND account_number IS NOT NULL) AS pending_validation,
          COUNT(*) FILTER (WHERE account_number IS NULL)   AS missing_bank_details,
          COUNT(DISTINCT deployment_state)                 AS states_covered,
          COUNT(DISTINCT batch)                            AS batches
          FROM corps_members`),

        query(`SELECT
          COUNT(*)                                         AS total_payments,
          COUNT(*) FILTER (WHERE status = 'success')      AS successful,
          COUNT(*) FILTER (WHERE status = 'failed')       AS failed,
          COUNT(*) FILTER (WHERE status = 'pending')      AS pending,
          COUNT(*) FILTER (WHERE status = 'processing')   AS processing,
          COALESCE(SUM(amount)
            FILTER (WHERE status = 'success'), 0)         AS total_disbursed,
          COALESCE(AVG(retry_count), 0)                   AS avg_retries,
          ROUND(COUNT(*) FILTER (WHERE status = 'success')
            * 100.0 / NULLIF(COUNT(*), 0), 2)             AS success_rate
          FROM payments`),

        query(`SELECT
          COUNT(*)                                          AS total_batches,
          COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
          COUNT(*) FILTER (WHERE status = 'processing')    AS processing,
          COUNT(*) FILTER (WHERE status = 'failed')        AS failed,
          COALESCE(SUM(total_amount), 0)                   AS total_batch_amount
          FROM payment_batches`),

        query(`SELECT
          COUNT(*)                                           AS total,
          COUNT(*) FILTER (WHERE status = 'approved')       AS approved,
          COUNT(*) FILTER (WHERE status = 'pending')        AS pending,
          COUNT(*) FILTER (WHERE status = 'rejected')       AS rejected,
          ROUND(COUNT(*) FILTER (WHERE status = 'approved')
            * 100.0 / NULLIF(COUNT(*), 0), 2)              AS approval_rate
          FROM clearances WHERE clearance_month = $1`,
          [monthStr]),

        query(`SELECT
          COUNT(*)                                           AS total_events,
          COUNT(*) FILTER (WHERE action LIKE 'LOGIN%')      AS login_events,
          COUNT(*) FILTER (WHERE action LIKE 'PAYMENT%')    AS payment_events,
          COUNT(*) FILTER (WHERE action LIKE 'OTP%')        AS otp_events,
          COUNT(*) FILTER
            (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
          FROM audit_logs`),

        query(`SELECT
          COUNT(*)                                          AS total_users,
          COUNT(*) FILTER (WHERE role = 'admin')           AS admins,
          COUNT(*) FILTER (WHERE role = 'finance_officer') AS finance_officers,
          COUNT(*) FILTER
            (WHERE role = 'state_coordinator')             AS coordinators,
          COUNT(*) FILTER (WHERE is_active = TRUE)         AS active_users
          FROM users`),

        query(`SELECT al.action, al.entity_type,
                 al.created_at, u.full_name AS actor_name
               FROM audit_logs al
               LEFT JOIN users u ON al.actor_id = u.id
               ORDER BY al.created_at DESC LIMIT 10`),
      ]);

    return sendSuccess(res, 200, 'System dashboard retrieved.', {
      generated_at: new Date().toISOString(),
      current_month: monthStr,
      corps_members:  memberStats.rows[0],
      payments:       paymentStats.rows[0],
      batches:        batchStats.rows[0],
      clearances:     { month: monthStr, ...clearanceStats.rows[0] },
      audit: {
        ...auditStats.rows[0],
        recent_events: recentEvents.rows,
      },
      users: userStats.rows[0],
    });

  } catch (error) {
    console.error('GetSystemDashboard error:', error.message);
    return sendError(res, 500, 'Could not retrieve system dashboard.');
  }
};

// ── GET ACTION SUMMARY ────────────────────────────────────────
// GET /api/audit/action-summary
const getActionSummary = async (req, res) => {
  try {
    const result = await query(`
      SELECT action,
             COUNT(*)         AS count,
             MAX(created_at)  AS last_occurrence
      FROM audit_logs
      GROUP BY action
      ORDER BY count DESC
    `);
    return sendSuccess(res, 200, 'Action summary retrieved.', {
      actions: result.rows,
    });
  } catch (error) {
    console.error('GetActionSummary error:', error.message);
    return sendError(res, 500, 'Could not retrieve action summary.');
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogsByEntity,
  getSystemDashboard,
  getActionSummary,
};