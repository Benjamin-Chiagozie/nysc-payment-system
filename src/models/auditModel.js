// ============================================================
// NYSC Payment Platform — Audit Log Model
// Every significant action is permanently recorded here
// This table is APPEND ONLY — no updates, no deletes
// ============================================================

const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const createAuditLog = async ({
  actor_id = null,
  actor_type = 'system',
  action,
  entity_type = null,
  entity_id = null,
  details = null,
  ip_address = null,
}) => {
  try {
    await query(
      `INSERT INTO audit_logs
         (id, actor_id, actor_type, action,
          entity_type, entity_id, details, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        uuidv4(),
        actor_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        details ? JSON.stringify(details) : null,
        ip_address,
      ]
    );
  } catch (error) {
    // Audit log failures should never crash the main application
    console.error('Audit log error:', error.message);
  }
};

const getAuditLogs = async (limit = 100, offset = 0) => {
  const result = await query(
    `SELECT
       al.id, al.actor_type, al.action,
       al.entity_type, al.entity_id,
       al.details, al.ip_address, al.created_at,
       u.full_name AS actor_name, u.role AS actor_role
     FROM audit_logs al
     LEFT JOIN users u ON al.actor_id = u.id
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
};

module.exports = { createAuditLog, getAuditLogs };