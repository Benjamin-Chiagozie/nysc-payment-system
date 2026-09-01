// ============================================================
// NYSC Payment Platform — Paystack Service
// Handles all communication with the Paystack API
// This service is the ONLY file that talks to Paystack directly
// Every other file imports from here
// ============================================================

const axios = require('axios');

// Create a pre-configured axios instance for Paystack
// This means we never have to repeat the base URL or
// authorization header in every request
const paystackAPI = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// ── VERIFY BANK ACCOUNT ───────────────────────────────────────
// Calls Paystack's bank account resolution endpoint
// Returns account holder name if valid
// Throws an error if invalid
const verifyBankAccount = async (account_number, bank_code) => {
  try {
    const response = await paystackAPI.get(
      `/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`
    );
    return {
      success: true,
      account_name: response.data.data.account_name,
      account_number: response.data.data.account_number,
      bank_id: response.data.data.bank_id,
    };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      'Could not verify account. Check account number and bank code.';
    return {
      success: false,
      error: message,
    };
  }
};

// ── CREATE TRANSFER RECIPIENT ─────────────────────────────────
// Registers a corps member as a transfer recipient on Paystack
// Returns a recipient_code used to send money in Sprint 6
const createTransferRecipient = async ({
  full_name,
  account_number,
  bank_code,
  state_code,
}) => {
  try {
    const response = await paystackAPI.post('/transferrecipient', {
      type: 'nuban',
      name: full_name,
      account_number,
      bank_code,
      currency: 'NGN',
      description: `NYSC Corps Member - ${state_code}`,
    });
    return {
      success: true,
      recipient_code: response.data.data.recipient_code,
      recipient_id: response.data.data.id,
      details: response.data.data,
    };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      'Could not create transfer recipient.';
    return {
      success: false,
      error: message,
    };
  }
};

// ── GET LIST OF BANKS ─────────────────────────────────────────
// Returns all Nigerian banks supported by Paystack
// Used to populate bank selection dropdowns
const getBankList = async () => {
  try {
    const response = await paystackAPI.get('/bank?currency=NGN&perPage=100');
    return {
      success: true,
      banks: response.data.data.map((bank) => ({
        name: bank.name,
        code: bank.code,
        slug: bank.slug,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: 'Could not fetch bank list.',
    };
  }
};

// ── INITIATE TRANSFER ─────────────────────────────────────────
// Sends money to a corps member via their recipient_code
// Used in Sprint 6 payment engine
const initiateTransfer = async ({
  amount,
  recipient_code,
  reference,
  reason,
}) => {
  try {
    const response = await paystackAPI.post('/transfer', {
      source: 'balance',
      amount: amount * 100, // Paystack uses kobo (multiply by 100)
      recipient: recipient_code,
      reference,
      reason,
    });
    return {
      success: true,
      transfer_code: response.data.data.transfer_code,
      status: response.data.data.status,
      reference: response.data.data.reference,
    };
  } catch (error) {
    const message =
      error.response?.data?.message || 'Transfer initiation failed.';
    return {
      success: false,
      error: message,
    };
  }
};

// ── VERIFY TRANSFER STATUS ────────────────────────────────────
// Checks the current status of a transfer
// Used in Sprint 6 for reconciliation
const verifyTransfer = async (reference) => {
  try {
    const response = await paystackAPI.get(`/transfer/verify/${reference}`);
    return {
      success: true,
      status: response.data.data.status,
      amount: response.data.data.amount / 100, // convert back from kobo
      reference: response.data.data.reference,
      transfer_code: response.data.data.transfer_code,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Could not verify transfer status.',
    };
  }
};

module.exports = {
  verifyBankAccount,
  createTransferRecipient,
  getBankList,
  initiateTransfer,
  verifyTransfer,
};