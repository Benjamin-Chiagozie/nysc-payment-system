// ============================================================
// NYSC Payment Platform — Email Service
// Handles OTP delivery and payment notification emails
// ============================================================

const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// ── SEND OTP EMAIL ────────────────────────────────────────────
const sendOTPEmail = async ({ to, full_name, otp_code, expires_minutes }) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: 'NYSC Payment System — OTP Authorization Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a5276;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">NYSC Payment System</h1>
            <p style="color:#aed6f1;margin:5px 0;">Secure Payment Authorization</p>
          </div>
          <div style="padding:30px;background:#f8f9fa;">
            <p>Dear <strong>${full_name}</strong>,</p>
            <p>You requested to authorize a payment batch dispatch.
               Your One-Time Password (OTP) is:</p>
            <div style="text-align:center;margin:30px 0;">
              <span style="
                font-size:48px;font-weight:bold;
                letter-spacing:12px;color:#1a5276;
                background:#eaf2ff;padding:20px 30px;
                border-radius:8px;border:2px solid #2e86c1;
              ">${otp_code}</span>
            </div>
            <p style="color:#e74c3c;">
              ⚠️ This OTP expires in <strong>${expires_minutes} minutes</strong>.
            </p>
            <p>If you did not request this, contact your administrator immediately.</p>
          </div>
          <div style="background:#1a5276;padding:15px;text-align:center;">
            <p style="color:#aed6f1;margin:0;font-size:12px;">
              NYSC Automated Payment Disbursement Platform
            </p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
};

// ── SEND PAYMENT SUCCESS EMAIL ────────────────────────────────
const sendPaymentSuccessEmail = async ({
  to, full_name, state_code, amount, payment_month, reference,
}) => {
  try {
    const transporter = createTransporter();
    const formattedAmount = new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: 'NGN',
    }).format(amount);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `NYSC Allowance Payment — ${payment_month} — Successful`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1e8449;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">✅ Payment Successful</h1>
          </div>
          <div style="padding:30px;">
            <p>Dear <strong>${full_name}</strong> (${state_code}),</p>
            <p>Your NYSC monthly allowance for
               <strong>${payment_month}</strong> has been disbursed.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr style="background:#f2f3f4;">
                <td style="padding:12px;border:1px solid #ddd;"><strong>Amount</strong></td>
                <td style="padding:12px;border:1px solid #ddd;">${formattedAmount}</td>
              </tr>
              <tr>
                <td style="padding:12px;border:1px solid #ddd;"><strong>Month</strong></td>
                <td style="padding:12px;border:1px solid #ddd;">${payment_month}</td>
              </tr>
              <tr style="background:#f2f3f4;">
                <td style="padding:12px;border:1px solid #ddd;"><strong>Reference</strong></td>
                <td style="padding:12px;border:1px solid #ddd;">${reference}</td>
              </tr>
            </table>
            <p>Please allow up to 24 hours for funds to reflect in your account.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    console.error('Payment email error:', error.message);
    return { success: false, error: error.message };
  }
};

// ── SEND PAYMENT FAILED EMAIL ─────────────────────────────────
const sendPaymentFailedEmail = async ({
  to, full_name, state_code, payment_month, reason,
}) => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: `NYSC Allowance Payment — ${payment_month} — Action Required`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#c0392b;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;">⚠️ Payment Unsuccessful</h1>
          </div>
          <div style="padding:30px;">
            <p>Dear <strong>${full_name}</strong> (${state_code}),</p>
            <p>We could not process your NYSC allowance for
               <strong>${payment_month}</strong>.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please visit your state coordination office or contact
               your LGI to resolve this issue.</p>
          </div>
        </div>
      `,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
};