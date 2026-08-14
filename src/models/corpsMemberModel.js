// ============================================================
// NYSC Payment Platform — Corps Member Model
// All database queries related to corps members live here
// ============================================================

const { query } = require('../config/database');

// ── GET ALL CORPS MEMBERS ─────────────────────────────────────
// Supports filtering by state, batch, validation status
// Supports searching by name or state code
// Supports pagination (page and limit)
const getAllCorpsMembers = async ({
  page = 1,
  limit = 20,
  deployment_state,
  batch,
  account_validated,
  search,
  is_active,
}) => {
  let conditions = [];
  let values = [];
  let idx = 1;

  if (deployment_state) {
    conditions.push(`deployment_state ILIKE $${idx++}`);
    values.push(`%${deployment_state}%`);
  }

  if (batch) {
    conditions.push(`batch = $${idx++}`);
    values.push(batch);
  }

  if (account_validated !== undefined && account_validated !== '') {
    conditions.push(`account_validated = $${idx++}`);
    values.push(account_validated === 'true' || account_validated === true);
  }

  if (is_active !== undefined && is_active !== '') {
    conditions.push(`is_active = $${idx++}`);
    values.push(is_active === 'true' || is_active === true);
  }

  if (search) {
    conditions.push(
      `(full_name ILIKE $${idx} OR state_code ILIKE $${idx} OR email ILIKE $${idx})`
    );
    values.push(`%${search}%`);
    idx++;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count for pagination
  const countResult = await query(
    `SELECT COUNT(*) FROM corps_members ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results
  const offset = (page - 1) * limit;
  values.push(limit);
  values.push(offset);

  const result = await query(
    `SELECT
       id, state_code, full_name, email, phone_number,
       deployment_state, deployment_lga, ppa_name, batch,
       bank_name, bank_code, account_number, account_name,
       account_validated, is_active, created_at, updated_at
     FROM corps_members
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    values
  );

  return {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil(total / limit),
    members: result.rows,
  };
};

// ── GET SINGLE CORPS MEMBER BY ID ─────────────────────────────
const getCorpsMemberById = async (id) => {
  const result = await query(
    `SELECT
       cm.*,
       (
         SELECT json_agg(c ORDER BY c.clearance_month DESC)
         FROM clearances c
         WHERE c.corps_member_id = cm.id
       ) AS clearances,
       (
         SELECT json_agg(p ORDER BY p.initiated_at DESC)
         FROM payments p
         WHERE p.corps_member_id = cm.id
       ) AS payments
     FROM corps_members cm
     WHERE cm.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// ── GET CORPS MEMBER BY STATE CODE ────────────────────────────
const getCorpsMemberByStateCode = async (state_code) => {
  const result = await query(
    `SELECT * FROM corps_members WHERE state_code = $1`,
    [state_code]
  );
  return result.rows[0] || null;
};

// ── UPDATE BANK DETAILS ───────────────────────────────────────
const updateBankDetails = async (id, {
  bank_name,
  bank_code,
  account_number,
  account_name,
}) => {
  const result = await query(
    `UPDATE corps_members
     SET
       bank_name = $1,
       bank_code = $2,
       account_number = $3,
       account_name = $4,
       account_validated = FALSE,
       paystack_recipient_code = NULL,
       updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [bank_name, bank_code, account_number, account_name, id]
  );
  return result.rows[0] || null;
};

// ── DEACTIVATE CORPS MEMBER ───────────────────────────────────
const deactivateCorpsMember = async (id) => {
  const result = await query(
    `UPDATE corps_members
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id, state_code, full_name, is_active`,
    [id]
  );
  return result.rows[0] || null;
};

// ── REACTIVATE CORPS MEMBER ───────────────────────────────────
const reactivateCorpsMember = async (id) => {
  const result = await query(
    `UPDATE corps_members
     SET is_active = TRUE, updated_at = NOW()
     WHERE id = $1
     RETURNING id, state_code, full_name, is_active`,
    [id]
  );
  return result.rows[0] || null;
};

// ── DASHBOARD SUMMARY ─────────────────────────────────────────
const getDashboardSummary = async () => {
  const result = await query(`
    SELECT
      COUNT(*)                                          AS total_members,
      COUNT(*) FILTER (WHERE is_active = TRUE)          AS active_members,
      COUNT(*) FILTER (WHERE is_active = FALSE)         AS inactive_members,
      COUNT(*) FILTER (WHERE account_validated = TRUE)  AS validated_accounts,
      COUNT(*) FILTER (WHERE account_validated = FALSE
                       AND account_number IS NOT NULL)  AS pending_validation,
      COUNT(*) FILTER (WHERE account_number IS NULL)    AS missing_bank_details,
      COUNT(DISTINCT deployment_state)                  AS states_covered,
      COUNT(DISTINCT batch)                             AS batches
    FROM corps_members
  `);
  return result.rows[0];
};

// ── GET MEMBERS ELIGIBLE FOR PAYMENT ─────────────────────────
// Used by Sprint 6 payment engine
// Returns members who have an approved clearance
// for the given month AND a validated bank account
const getEligibleMembers = async (payment_month) => {
  const result = await query(
    `SELECT
       cm.id, cm.state_code, cm.full_name,
       cm.bank_name, cm.bank_code,
       cm.account_number, cm.account_name,
       cm.paystack_recipient_code,
       c.id AS clearance_id
     FROM corps_members cm
     INNER JOIN clearances c
       ON c.corps_member_id = cm.id
       AND c.clearance_month = $1
       AND c.status = 'approved'
     WHERE cm.account_validated = TRUE
       AND cm.is_active = TRUE
       AND cm.paystack_recipient_code IS NOT NULL`,
    [payment_month]
  );
  return result.rows;
};

module.exports = {
  getAllCorpsMembers,
  getCorpsMemberById,
  getCorpsMemberByStateCode,
  updateBankDetails,
  deactivateCorpsMember,
  reactivateCorpsMember,
  getDashboardSummary,
  getEligibleMembers,
};