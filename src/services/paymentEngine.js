// ============================================================
// NYSC Payment Platform — Payment Engine
// Core payment processing: batch creation, dispatch, retry
// ============================================================

const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const paystackService = require('./paystackService');
const { createAuditLog } = require('../models/auditModel');
const {
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
} = require('./emailService');

const ALLOWANCE_AMOUNT = parseFloat(process.env.ALLOWANCE_AMOUNT) || 77000;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 50;
const BATCH_INTERVAL_MS = parseInt(process.env.BATCH_INTERVAL_MS) || 5000;

// ── GENERATE IDEMPOTENCY KEY ──────────────────────────────────
const generateIdempotencyKey = (corps_member_id, payment_month) => {
  const monthStr = payment_month.toString().substring(0, 7);
  return `NYSC-${corps_member_id}-${monthStr}`;
};

// ── GET ELIGIBLE MEMBERS ──────────────────────────────────────
const getEligibleMembers = async (payment_month) => {
  const result = await query(
    `SELECT
       cm.id, cm.state_code, cm.full_name,
       cm.email, cm.phone_number,
       cm.bank_name, cm.account_number,
       cm.paystack_recipient_code,
       c.id AS clearance_id
     FROM corps_members cm
     INNER JOIN clearances c
       ON c.corps_member_id = cm.id
       AND c.clearance_month = $1
       AND c.status = 'approved'
     WHERE cm.account_validated = TRUE
       AND cm.is_active = TRUE
       AND cm.paystack_recipient_code IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.corps_member_id = cm.id
           AND p.payment_month = $1
           AND p.status IN ('success', 'processing', 'pending')
       )
     ORDER BY cm.state_code ASC`,
    [payment_month]
  );
  return result.rows;
};

// ── PROCESS SINGLE PAYMENT ────────────────────────────────────
const processSinglePayment = async (payment, member) => {
  try {
    await query(
      `UPDATE payments
       SET status = 'processing', initiated_at = NOW()
       WHERE id = $1`,
      [payment.id]
    );

    const transfer = await paystackService.initiateTransfer({
      amount: payment.amount,
      recipient_code: member.paystack_recipient_code,
      reference: payment.idempotency_key,
      reason: `NYSC Monthly Allowance — ${payment.payment_month}`,
    });

    if (transfer.success) {
      await query(
        `UPDATE payments
         SET status = 'success',
             paystack_transfer_code = $1,
             paystack_reference = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [transfer.transfer_code, transfer.reference, payment.id]
      );

      await sendPaymentSuccessEmail({
        to: member.email,
        full_name: member.full_name,
        state_code: member.state_code,
        amount: payment.amount,
        payment_month: payment.payment_month,
        reference: transfer.reference,
      });

      await createAuditLog({
        actor_type: 'system',
        action: 'PAYMENT_SUCCESS',
        entity_type: 'payment',
        entity_id: payment.id,
        details: {
          state_code: member.state_code,
          amount: payment.amount,
          transfer_code: transfer.transfer_code,
        },
      });

      return { success: true, payment_id: payment.id };

    } else {
      throw new Error(transfer.error || 'Transfer failed');
    }

  } catch (error) {
    const newRetryCount = (payment.retry_count || 0) + 1;
    const MAX_RETRIES = 3;

    await query(
      `UPDATE payments
       SET status = 'failed',
           retry_count = $1,
           failure_reason = $2
       WHERE id = $3`,
      [newRetryCount, error.message, payment.id]
    );

    if (newRetryCount >= MAX_RETRIES) {
      await sendPaymentFailedEmail({
        to: member.email,
        full_name: member.full_name,
        state_code: member.state_code,
        payment_month: payment.payment_month,
        reason: 'Payment failed after multiple attempts. Please contact your coordination office.',
      });
    }

    await createAuditLog({
      actor_type: 'system',
      action: newRetryCount >= MAX_RETRIES
        ? 'PAYMENT_FAILED_ESCALATED'
        : 'PAYMENT_FAILED_RETRY_SCHEDULED',
      entity_type: 'payment',
      entity_id: payment.id,
      details: {
        state_code: member.state_code,
        retry_count: newRetryCount,
        reason: error.message,
      },
    });

    return { success: false, payment_id: payment.id, error: error.message };
  }
};

// ── CREATE PAYMENT BATCH ──────────────────────────────────────
const createPaymentBatch = async (payment_month, created_by) => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const eligibleMembers = await getEligibleMembers(payment_month);

    if (eligibleMembers.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'No eligible members found. Ensure clearances are approved and accounts are validated.',
      };
    }

    const total_amount = eligibleMembers.length * ALLOWANCE_AMOUNT;
    const monthLabel = new Date(payment_month)
      .toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });

    const batchResult = await client.query(
      `INSERT INTO payment_batches
         (id, batch_month, batch_label, total_members,
          total_amount, status, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', NOW(), $6)
       RETURNING *`,
      [
        uuidv4(), payment_month,
        `${monthLabel} Allowance Batch`,
        eligibleMembers.length, total_amount, created_by,
      ]
    );

    const batch = batchResult.rows[0];

    for (const member of eligibleMembers) {
      const idempotency_key = generateIdempotencyKey(member.id, payment_month);
      await client.query(
        `INSERT INTO payments
           (id, corps_member_id, clearance_id, batch_id,
            payment_month, amount, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          uuidv4(), member.id, member.clearance_id,
          batch.id, payment_month, ALLOWANCE_AMOUNT, idempotency_key,
        ]
      );
    }

    await client.query('COMMIT');

    await createAuditLog({
      actor_id: created_by,
      actor_type: 'user',
      action: 'PAYMENT_BATCH_CREATED',
      entity_type: 'payment_batch',
      entity_id: batch.id,
      details: {
        payment_month,
        total_members: eligibleMembers.length,
        total_amount,
      },
    });

    return {
      success: true,
      batch,
      total_members: eligibleMembers.length,
      total_amount,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('CreatePaymentBatch error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// ── DISPATCH PAYMENT BATCH ────────────────────────────────────
const dispatchPaymentBatch = async (batch_id, initiated_by) => {
  try {
    await query(
      `UPDATE payment_batches
       SET status = 'processing', started_at = NOW()
       WHERE id = $1`,
      [batch_id]
    );

    const paymentsResult = await query(
      `SELECT
         p.id, p.corps_member_id, p.payment_month,
         p.amount, p.idempotency_key, p.retry_count,
         cm.state_code, cm.full_name, cm.email,
         cm.phone_number, cm.paystack_recipient_code
       FROM payments p
       INNER JOIN corps_members cm ON cm.id = p.corps_member_id
       WHERE p.batch_id = $1 AND p.status = 'pending'
       ORDER BY cm.state_code ASC`,
      [batch_id]
    );

    const payments = paymentsResult.rows;
    console.log(`\n💰 Dispatching ${payments.length} payments in sub-batches of ${BATCH_SIZE}...`);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < payments.length; i += BATCH_SIZE) {
      const subBatch = payments.slice(i, i + BATCH_SIZE);
      console.log(`\n   Sub-batch ${Math.floor(i / BATCH_SIZE) + 1} — ${subBatch.length} payments`);

      for (const payment of subBatch) {
        const result = await processSinglePayment(payment, {
          state_code: payment.state_code,
          full_name: payment.full_name,
          email: payment.email,
          paystack_recipient_code: payment.paystack_recipient_code,
        });
        if (result.success) successful++;
        else failed++;
      }

      if (i + BATCH_SIZE < payments.length) {
        console.log(`   ⏳ Waiting ${BATCH_INTERVAL_MS / 1000}s before next sub-batch...`);
        await new Promise((resolve) => setTimeout(resolve, BATCH_INTERVAL_MS));
      }
    }

    await query(
      `UPDATE payment_batches
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1`,
      [batch_id]
    );

    await createAuditLog({
      actor_id: initiated_by,
      actor_type: 'user',
      action: 'PAYMENT_BATCH_COMPLETED',
      entity_type: 'payment_batch',
      entity_id: batch_id,
      details: { total: payments.length, successful, failed },
    });

    console.log(`\n✅ Batch complete — Success: ${successful} | Failed: ${failed}`);
    return { success: true, successful, failed, total: payments.length };

  } catch (error) {
    await query(
      `UPDATE payment_batches SET status = 'failed' WHERE id = $1`,
      [batch_id]
    );
    throw error;
  }
};

// ── RETRY FAILED PAYMENTS ─────────────────────────────────────
const retryFailedPayments = async (batch_id, actor_id) => {
  const result = await query(
    `SELECT
       p.id, p.corps_member_id, p.payment_month,
       p.amount, p.idempotency_key, p.retry_count,
       cm.state_code, cm.full_name, cm.email,
       cm.paystack_recipient_code
     FROM payments p
     INNER JOIN corps_members cm ON cm.id = p.corps_member_id
     WHERE p.batch_id = $1
       AND p.status = 'failed'
       AND p.retry_count < 3`,
    [batch_id]
  );

  const failedPayments = result.rows;

  if (failedPayments.length === 0) {
    return { message: 'No retryable failed payments found.', retried: 0 };
  }

  await query(
    `UPDATE payments SET status = 'pending'
     WHERE batch_id = $1 AND status = 'failed' AND retry_count < 3`,
    [batch_id]
  );

  let retried = 0;
  for (const payment of failedPayments) {
    await processSinglePayment(payment, {
      state_code: payment.state_code,
      full_name: payment.full_name,
      email: payment.email,
      paystack_recipient_code: payment.paystack_recipient_code,
    });
    retried++;
  }

  await createAuditLog({
    actor_id,
    actor_type: 'user',
    action: 'PAYMENT_RETRY_INITIATED',
    entity_type: 'payment_batch',
    entity_id: batch_id,
    details: { retried_count: retried },
  });

  return {
    message: `Retry complete. ${retried} payments reprocessed.`,
    retried,
  };
};

module.exports = {
  createPaymentBatch,
  dispatchPaymentBatch,
  retryFailedPayments,
  getEligibleMembers,
};