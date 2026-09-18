// ============================================================
// NYSC Payment Platform — Audit Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getAuditLogs,
  getAuditLogsByEntity,
  getSystemDashboard,
  getActionSummary,
} = require('../controllers/auditController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('admin', 'finance_officer', 'state_coordinator'));

// System health dashboard
router.get('/dashboard', getSystemDashboard);

// Audit log viewer with filters
router.get('/logs', getAuditLogs);

// Action type summary
router.get('/action-summary', getActionSummary);

// Full audit trail for one specific record
router.get('/entity/:entityId', getAuditLogsByEntity);

module.exports = router;