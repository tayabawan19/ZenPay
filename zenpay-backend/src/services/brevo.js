const axios = require('axios');
require('dotenv').config();

/**
 * Send an OTP verification code email using Brevo's Transactional Smtp API
 * @param {string} toEmail 
 * @param {string} toName 
 * @param {string} otp 
 * @returns {Promise<Object>}
 */
const sendOTPEmail = async (toEmail, toName, otp) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'ZenPay';

  // Fallback to logs if keys are unconfigured placeholders
  if (!apiKey || apiKey.includes('your_') || apiKey.includes('placeholder')) {
    console.log(`\n======================================================\n[MOCK EMAIL SMTP] Sending OTP Code [${otp}] to User ${toName} (${toEmail})\n======================================================\n`);
    return { success: true, message: 'OTP logged to console (Mock mode)' };
  }

  const url = 'https://api.brevo.com/v3/smtp/email';
  
  const htmlContent = `
  <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 30px; border-radius: 10px; background: #F5F3FF;">
    <h2 style="color: #7B5EA7; margin-top: 0;">ZenPay Verification</h2>
    <p>Hello ${toName},</p>
    <p>Your OTP verification code is:</p>
    <div style="background-color: #FFFFFF; border: 1.5px solid #E5E7EB; border-radius: 12px; padding: 16px; margin: 24px 0; text-align: center;">
      <h1 style="color: #7B5EA7; letter-spacing: 8px; font-size: 36px; margin: 0; font-family: 'Courier New', Courier, monospace;">${otp}</h1>
    </div>
    <p>This code expires in <strong>5 minutes</strong>.</p>
    <p>If you didn't request this, ignore this email.</p>
    <p style="color: #6B7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #E5E7EB; padding-top: 12px;">— ZenPay Team</p>
  </div>
  `;

  try {
    const response = await axios.post(url, {
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail, name: toName }],
      subject: "Your ZenPay Verification Code",
      htmlContent: htmlContent
    }, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error("Brevo Email Send Failure: ", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || 'SMTP client network exception');
  }
};

module.exports = { sendOTPEmail };
