// ============================================================
// NYSC Payment Platform — Validation Service
// Orchestrates the bank account validation process
// ============================================================

const { query } = require('../config/database');
const paystackService = require('./paystackService');
const { createAuditLog } = require('../models/auditModel');

const validateSingleAccount = async (member, actor_id = null) => {
  if (!member.account_number || !member.bank_code) {
    return {
      success: false,
      state_code: member.state_code,
      reason: 'Missing bank details',
    };
  }

  const verification = await paystackService.verifyBankAccount(
    member.account_number,
    member.bank_code
  );

  if (!verification.success) {
    await query(
      `UPDATE corps_members
       SET account_validated = FALSE,
           account_name = NULL,
           paystack_recipient_code = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [member.id]
    );

    await createAuditLog({
      actor_id,
      actor_type: actor_id ? 'user' : 'system',
      action: 'ACCOUNT_VALIDATION_FAILED',
      entity_type: 'corps_member',
      entity_id: member.id,
      details: {
        state_code: member.state_code,
        account_number: member.account_number,
        bank_code: member.bank_code,
        reason: verification.error,
      },
    });

    return {
      success: false,
      state_code: member.state_code,
      reason: verification.error,
    };
  }

  const recipient = await paystackService.createTransferRecipient({
    full_name: verification.account_name,
    account_number: member.account_number,
    bank_code: member.bank_code,
    state_code: member.state_code,
  });

  if (!recipient.success) {
    return {
      success: false,
      state_code: member.state_code,
      reason: recipient.error,
    };
  }

  await query(
    `UPDATE corps_members
     SET account_validated = TRUE,
         account_name = $1,
         paystack_recipient_code = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [verification.account_name, recipient.recipient_code, member.id]
  );

  await createAuditLog({
    actor_id,
    actor_type: actor_id ? 'user' : 'system',
    action: 'ACCOUNT_VALIDATION_SUCCESS',
    entity_type: 'corps_member',
    entity_id: member.id,
    details: {
      state_code: member.state_code,
      account_name: verification.account_name,
      recipient_code: recipient.recipient_code,
    },
  });

  return {
    success: true,
    state_code: member.state_code,
    account_name: verification.account_name,
    recipient_code: recipient.recipient_code,
  };
};

const bulkValidateAccounts = async (actor_id = null) => {
  const result = await query(
    `SELECT id, state_code, full_name,
            account_number, bank_code, bank_name
     FROM corps_members
     WHERE account_validated = FALSE
       AND account_number IS NOT NULL
       AND bank_code IS NOT NULL
       AND is_active = TRUE
     ORDER BY created_at ASC`
  );

  const members = result.rows;
  const total = members.length;

  if (total === 0) {
    return {
      message: 'No pending accounts to validate.',
      total: 0, validated: 0, failed: 0, results: [],
    };
  }

  console.log(`\n🔄 Starting bulk validation for ${total} accounts...`);

  let validated = 0;
  let failed = 0;
  const results = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    console.log(`   Processing ${i + 1}/${total}: ${member.state_code}`);

    const result = await validateSingleAccount(member, actor_id);
    results.push(result);

    if (result.success) validated++;
    else failed++;

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Bulk validation complete:`);
  console.log(`   Validated: ${validated}`);
  console.log(`   Failed:    ${failed}`);

  return {
    message: `Bulk validation complete. ${validated} validated, ${failed} failed.`,
    total, validated, failed, results,
  };
};

module.exports = { validateSingleAccount, bulkValidateAccounts };