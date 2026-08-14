// ============================================================
// NYSC Payment Platform — Corps Member Routes
// All routes are protected — valid JWT required for all
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getAllCorpsMembers,
  getCorpsMemberById,
  getByStateCode,
  updateBankDetails,
  deactivateCorpsMember,
  reactivateCorpsMember,
  getDashboardSummary,
} = require('../controllers/corpsMemberController');

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validateBankDetails } = require('../validators/corpsMemberValidator');

// All routes below require a valid JWT token
router.use(protect);

// ── DASHBOARD ─────────────────────────────────────────────────
router.get(
  '/dashboard/summary',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getDashboardSummary
);

// ── READ ROUTES ───────────────────────────────────────────────
router.get(
  '/',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getAllCorpsMembers
);

router.get(
  '/state-code/:stateCode',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getByStateCode
);

router.get(
  '/:id',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getCorpsMemberById
);

// ── UPDATE ROUTES ─────────────────────────────────────────────
router.patch(
  '/:id/bank-details',
  restrictTo('admin', 'finance_officer'),
  validateBankDetails,
  updateBankDetails
);

router.patch(
  '/:id/deactivate',
  restrictTo('admin', 'state_coordinator'),
  deactivateCorpsMember
);

router.patch(
  '/:id/reactivate',
  restrictTo('admin', 'state_coordinator'),
  reactivateCorpsMember
);

module.exports = router;