// ============================================================
// NYSC Payment Platform — Payment Routes
// ============================================================

const express = require('express');
const router = express.Router();

const {
  requestPaymentOTP,
  initiatePaymentBatch,
  getAllBatches,
  getBatchById,
  getEligible,
  retryFailed,
  getMyPaymentStatus,
} = require('../controllers/paymentController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

// OTP flow
router.post('/request-otp', restrictTo('admin', 'finance_officer'), requestPaymentOTP);
router.post('/initiate-batch', restrictTo('admin', 'finance_officer'), initiatePaymentBatch);

// Batch management
router.get('/batches', restrictTo('admin', 'finance_officer', 'state_coordinator'), getAllBatches);
router.get('/batches/:id', restrictTo('admin', 'finance_officer', 'state_coordinator'), getBatchById);
router.post('/batches/:id/retry', restrictTo('admin', 'finance_officer'), retryFailed);

// Eligible members
router.get('/eligible', restrictTo('admin', 'finance_officer'), getEligible);

// Corps member payment status
router.get('/my-status/:stateCode', getMyPaymentStatus);

module.exports = router;