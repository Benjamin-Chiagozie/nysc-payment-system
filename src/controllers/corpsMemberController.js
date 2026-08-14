// ============================================================
// NYSC Payment Platform — Corps Member Controller
// Handles all corps member management operations
// ============================================================

const corpsMemberModel = require('../models/corpsMemberModel');
const { createAuditLog } = require('../models/auditModel');
const { sendSuccess, sendError } = require('../utils/response');

// ── GET ALL CORPS MEMBERS ─────────────────────────────────────
// GET /api/corps-members
// Supports: ?page=1&limit=20&search=John&deployment_state=Lagos
const getAllCorpsMembers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      deployment_state,
      batch,
      account_validated,
      search,
      is_active,
    } = req.query;

    const result = await corpsMemberModel.getAllCorpsMembers({
      page,
      limit,
      deployment_state,
      batch,
      account_validated,
      search,
      is_active,
    });

    return sendSuccess(
      res, 200,
      `${result.total} corps members found.`,
      result
    );
  } catch (error) {
    console.error('GetAllCorpsMembers error:', error.message);
    return sendError(res, 500, 'Could not retrieve corps members.');
  }
};

// ── GET SINGLE CORPS MEMBER ───────────────────────────────────
// GET /api/corps-members/:id
const getCorpsMemberById = async (req, res) => {
  try {
    const member = await corpsMemberModel.getCorpsMemberById(req.params.id);
    if (!member) {
      return sendError(res, 404, 'Corps member not found.');
    }
    return sendSuccess(res, 200, 'Corps member retrieved.', { member });
  } catch (error) {
    console.error('GetCorpsMember error:', error.message);
    return sendError(res, 500, 'Could not retrieve corps member.');
  }
};

// ── GET BY STATE CODE ─────────────────────────────────────────
// GET /api/corps-members/state-code/:stateCode
const getByStateCode = async (req, res) => {
  try {
    const member = await corpsMemberModel.getCorpsMemberByStateCode(
      req.params.stateCode.toUpperCase()
    );
    if (!member) {
      return sendError(res, 404, 'No corps member found with that state code.');
    }
    return sendSuccess(res, 200, 'Corps member retrieved.', { member });
  } catch (error) {
    console.error('GetByStateCode error:', error.message);
    return sendError(res, 500, 'Could not retrieve corps member.');
  }
};

// ── UPDATE BANK DETAILS ───────────────────────────────────────
// PATCH /api/corps-members/:id/bank-details
const updateBankDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Check member exists
    const existing = await corpsMemberModel.getCorpsMemberById(id);
    if (!existing) {
      return sendError(res, 404, 'Corps member not found.');
    }

    const updated = await corpsMemberModel.updateBankDetails(id, req.body);

    // Record in audit log
    await createAuditLog({
      actor_id: req.user.id,
      actor_type: 'user',
      action: 'BANK_DETAILS_UPDATED',
      entity_type: 'corps_member',
      entity_id: id,
      details: {
        updated_by: req.user.email,
        state_code: existing.state_code,
        old_account: existing.account_number,
        new_account: req.body.account_number,
        bank_name: req.body.bank_name,
      },
      ip_address: req.ip,
    });

    return sendSuccess(
      res, 200,
      'Bank details updated successfully. Account validation status has been reset.',
      { member: updated }
    );
  } catch (error) {
    console.error('UpdateBankDetails error:', error.message);
    return sendError(res, 500, 'Could not update bank details.');
  }
};

// ── DEACTIVATE CORPS MEMBER ───────────────────────────────────
// PATCH /api/corps-members/:id/deactivate
const deactivateCorpsMember = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await corpsMemberModel.getCorpsMemberById(id);
    if (!existing) {
      return sendError(res, 404, 'Corps member not found.');
    }

    if (!existing.is_active) {
      return sendError(res, 400, 'Corps member is already inactive.');
    }

    const updated = await corpsMemberModel.deactivateCorpsMember(id);

    await createAuditLog({
      actor_id: req.user.id,
      actor_type: 'user',
      action: 'CORPS_MEMBER_DEACTIVATED',
      entity_type: 'corps_member',
      entity_id: id,
      details: {
        deactivated_by: req.user.email,
        state_code: existing.state_code,
        full_name: existing.full_name,
      },
      ip_address: req.ip,
    });

    return sendSuccess(
      res, 200,
      'Corps member deactivated successfully.',
      { member: updated }
    );
  } catch (error) {
    console.error('Deactivate error:', error.message);
    return sendError(res, 500, 'Could not deactivate corps member.');
  }
};

// ── REACTIVATE CORPS MEMBER ───────────────────────────────────
// PATCH /api/corps-members/:id/reactivate
const reactivateCorpsMember = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await corpsMemberModel.getCorpsMemberById(id);
    if (!existing) {
      return sendError(res, 404, 'Corps member not found.');
    }

    if (existing.is_active) {
      return sendError(res, 400, 'Corps member is already active.');
    }

    const updated = await corpsMemberModel.reactivateCorpsMember(id);

    await createAuditLog({
      actor_id: req.user.id,
      actor_type: 'user',
      action: 'CORPS_MEMBER_REACTIVATED',
      entity_type: 'corps_member',
      entity_id: id,
      details: {
        reactivated_by: req.user.email,
        state_code: existing.state_code,
      },
      ip_address: req.ip,
    });

    return sendSuccess(res, 200, 'Corps member reactivated successfully.', {
      member: updated,
    });
  } catch (error) {
    console.error('Reactivate error:', error.message);
    return sendError(res, 500, 'Could not reactivate corps member.');
  }
};

// ── DASHBOARD SUMMARY ─────────────────────────────────────────
// GET /api/corps-members/dashboard/summary
const getDashboardSummary = async (req, res) => {
  try {
    const summary = await corpsMemberModel.getDashboardSummary();
    return sendSuccess(
      res, 200,
      'Dashboard summary retrieved.',
      { summary }
    );
  } catch (error) {
    console.error('Dashboard error:', error.message);
    return sendError(res, 500, 'Could not retrieve dashboard summary.');
  }
};

module.exports = {
  getAllCorpsMembers,
  getCorpsMemberById,
  getByStateCode,
  updateBankDetails,
  deactivateCorpsMember,
  reactivateCorpsMember,
  getDashboardSummary,
};