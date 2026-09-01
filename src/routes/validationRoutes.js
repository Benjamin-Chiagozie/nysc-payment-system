// ============================================================
// NYSC Payment Platform — Validation Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  getBanks,
  validateSingle,
  bulkValidate,
  getValidationSummary,
} = require('../controllers/validationController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/banks', getBanks);

router.get(
  '/summary',
  restrictTo('admin', 'finance_officer', 'state_coordinator'),
  getValidationSummary
);

router.post(
  '/validate/:id',
  restrictTo('admin', 'finance_officer'),
  validateSingle
);

router.post(
  '/bulk-validate',
  restrictTo('admin', 'finance_officer'),
  bulkValidate
);

module.exports = router;