// ============================================================
// NYSC Payment Platform — Webhook Controller
// Handles real-time payment event callbacks from Paystack
// Paystack calls this endpoint the moment a payment
// succeeds, fails, or is reversed
// ============================================================

const crypto = require('crypto');
const { query } = require('../config/database');
const { createAuditLog } = require('../models/auditModel');
const {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
} = require('../services/emailService');
const { sendSuccess, sendError } = require('../utils/response');

// ── VERIFY PAYSTACK WEBHOOK SIGNATURE ────────────────────────
// Paystack signs every webhook with HMAC-SHA512
// We verify this signature to confirm the request
// genuinely came from Paystack and not a fake source
const verifyPaystackSignature = (req) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature) return false;

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  return hash === signature;
};

// ── UPDATE PAYMENT STATUS ─────────────────────────────────────
const updatePaymentStatus = async (reference, status, transfer_code) => {
  const result = await query(
    `UPDATE payments
     SET status = $1,
         paystack_transfer_code = $2,
         completed_at = CASE WHEN $1 IN ('success','reversed')
                        THEN NOW() ELSE completed_at END
     WHERE idempotency_key = $3
        OR paystack_reference = $3
     RETURNING
       id, corps_member_id, payment_month,
       amount, status, idempotency_key`,
    [status, transfer_code, reference]
  );
  return result.rows[0] || null;
};

// ── GET CORPS MEMBER DETAILS ──────────────────────────────────
const getCorpsMemberDetails = async (corps_member_id) => {
  const result = await query(
    `SELECT id, state_code, full_name, email, phone_number
     FROM corps_members
     WHERE id = $1`,
    [corps_member_id]
  );
  return result.rows[0] || null;
};

// ── MAIN WEBHOOK HANDLER ──────────────────────────────────────
// POST /api/webhook/paystack
const handlePaystackWebhook = async (req, res) => {
  try {
    // Step 1: Verify the webhook signature
    if (!verifyPaystackSignature(req)) {
      console.error('❌ Invalid Paystack webhook signature');
      await createAuditLog({
        actor_type: 'system',
        action: 'WEBHOOK_SIGNATURE_INVALID',
        details: {
          ip: req.ip,
          headers: req.headers['x-paystack-signature'],
        },
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature',
      });
    }

    const event = req.body;
    const eventType = event.event;
    const data = event.data;

    console.log(`\n📩 Paystack webhook received: ${eventType}`);

    // Step 2: Handle different event types
    switch (eventType) {

      // ── TRANSFER SUCCESS ──────────────────────────────────
      case 'transfer.success': {
        const payment = await updatePaymentStatus(
          data.reference,
          'success',
          data.transfer_code
        );

        if (payment) {
          const member = await getCorpsMemberDetails(payment.corps_member_id);

          if (member) {
            // Send success email notification
            await sendPaymentSuccessEmail({
              to: member.email,
              full_name: member.full_name,
              state_code: member.state_code,
              amount: payment.amount,
              payment_month: payment.payment_month,
              reference: data.reference,
            });

            console.log(`   ✅ Payment confirmed for ${member.state_code}`);
          }

          await createAuditLog({
            actor_type: 'system',
            action: 'WEBHOOK_TRANSFER_SUCCESS',
            entity_type: 'payment',
            entity_id: payment.id,
            details: {
              reference: data.reference,
              transfer_code: data.transfer_code,
              amount: data.amount / 100,
            },
          });
        }
        break;
      }

      // ── TRANSFER FAILED ───────────────────────────────────
      case 'transfer.failed': {
        const payment = await updatePaymentStatus(
          data.reference,
          'failed',
          data.transfer_code
        );

        if (payment) {
          const member = await getCorpsMemberDetails(payment.corps_member_id);

          if (member) {
            await sendPaymentFailedEmail({
              to: member.email,
              full_name: member.full_name,
              state_code: member.state_code,
              payment_month: payment.payment_month,
              reason: data.reason || 'Transfer failed. Please contact your coordination office.',
            });

            console.log(`   ❌ Payment failed for ${member.state_code}`);
          }

          await createAuditLog({
            actor_type: 'system',
            action: 'WEBHOOK_TRANSFER_FAILED',
            entity_type: 'payment',
            entity_id: payment.id,
            details: {
              reference: data.reference,
              reason: data.reason,
            },
          });
        }
        break;
      }

      // ── TRANSFER REVERSED ─────────────────────────────────
      case 'transfer.reversed': {
        const payment = await updatePaymentStatus(
          data.reference,
          'reversed',
          data.transfer_code
        );

        if (payment) {
          await createAuditLog({
            actor_type: 'system',
            action: 'WEBHOOK_TRANSFER_REVERSED',
            entity_type: 'payment',
            entity_id: payment.id,
            details: {
              reference: data.reference,
              reason: 'Transfer reversed by Paystack',
            },
          });

          console.log(`   🔄 Payment reversed: ${data.reference}`);
        }
        break;
      }

      default:
        console.log(`   ℹ️ Unhandled event type: ${eventType}`);
    }

    // Always respond 200 to Paystack immediately
    // If we don't respond quickly, Paystack will retry
    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(200).json({ received: true });
  }
};

module.exports = { handlePaystackWebhook };