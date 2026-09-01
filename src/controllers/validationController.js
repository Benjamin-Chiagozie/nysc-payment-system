// ============================================================
// NYSC Payment Platform — Validation Controller
// ============================================================

const { query } = require('../config/database');
const { validateSingleAccount, bulkValidateAccounts } = require('../services/validationService');
const paystackService = require('../services/paystackService');
const { sendSuccess, sendError } = require('../utils/response');

const getBanks = async (req, res) => {
  try {
    const result = await paystackService.getBankList();
    if (!result.success) {
      return sendError(res, 500, 'Could not fetch bank list from Paystack.');
    }
    return sendSuccess(res, 200, `${result.banks.length} banks retrieved.`, {
      banks: result.banks,
    });
  } catch (error) {
    console.error('GetBanks error:', error.message);
    return sendError(res, 500, 'Could not fetch banks.');
  }
};

const validateSingle = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, state_code, full_name,
              account_number, bank_code, bank_name,
              account_validated
       FROM corps_members WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Corps member not found.');
    }

    const member = result.rows[0];

    if (member.account_validated) {
      return sendError(
        res, 400,
        'This account is already validated. Update bank details first to re-validate.'
      );
    }

    const validationResult = await validateSingleAccount(member, req.user.id);

    if (!validationResult.success) {
      return sendError(
        res, 422,
        `Account validation failed: ${validationResult.reason}`,
        { state_code: member.state_code }
      );
    }

    return sendSuccess(res, 200, 'Account validated successfully.', {
      state_code: validationResult.state_code,
      account_name: validationResult.account_name,
      recipient_code: validationResult.recipient_code,
    });

  } catch (error) {
    console.error('ValidateSingle error:', error.message);
    return sendError(res, 500, 'Validation failed. Please try again.');
  }
};

const bulkValidate = async (req, res) => {
  try {
    console.log(`\n📋 Bulk validation initiated by: ${req.user.email}`);
    const result = await bulkValidateAccounts(req.user.id);
    return sendSuccess(res, 200, result.message, {
      total: result.total,
      validated: result.validated,
      failed: result.failed,
    });
  } catch (error) {
    console.error('BulkValidate error:', error.message);
    return sendError(res, 500, 'Bulk validation failed.');
  }
};

const getValidationSummary = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                         AS total,
        COUNT(*) FILTER (WHERE account_validated = TRUE) AS validated,
        COUNT(*) FILTER (WHERE account_validated = FALSE
                         AND account_number IS NOT NULL) AS pending,
        COUNT(*) FILTER (WHERE account_number IS NULL)   AS missing_details
      FROM corps_members
      WHERE is_active = TRUE
    `);
    return sendSuccess(res, 200, 'Validation summary retrieved.', {
      summary: result.rows[0],
    });
  } catch (error) {
    console.error('ValidationSummary error:', error.message);
    return sendError(res, 500, 'Could not retrieve validation summary.');
  }
};

module.exports = { getBanks, validateSingle, bulkValidate, getValidationSummary };