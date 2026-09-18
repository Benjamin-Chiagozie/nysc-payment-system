// ============================================================
// NYSC Payment Platform — Webhook Routes
// Public route — Paystack calls this directly
// NO authentication middleware here
// Paystack webhook does not send JWT tokens
// Security is handled by signature verification instead
// ============================================================

const express = require('express');
const router = express.Router();

const { handlePaystackWebhook } = require('../controllers/webhookController');

// Paystack webhook endpoint
// This URL must be registered in your Paystack dashboard
// Settings → API Keys & Webhooks → Webhook URL
router.post('/paystack', handlePaystackWebhook);

module.exports = router;
