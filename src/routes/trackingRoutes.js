// ============================================================
// NYSC Payment Platform — Tracking Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getPaymentStatusByStateCode,
  getPaymentAnalytics,
  getFailedPaymentsReport,
  getClearanceOverview,
} = require('../controllers/trackingController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// Corps member — check own payment status by state code
router.get('/status/:stateCode', getPaymentStatusByStateCode);

// Admin/officer routes
router.get(
  '/analytics',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getPaymentAnalytics
);

router.get(
  '/failed-payments',
  restrictTo('admin', 'finance_officer'),
  getFailedPaymentsReport
);

router.get(
  '/clearances',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getClearanceOverview
);

module.exports = router;