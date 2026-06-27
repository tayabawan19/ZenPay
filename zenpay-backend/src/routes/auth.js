const express = require('express');
const router = express.Router();
const validateRequest = require('../middleware/validateRequest');
const { db } = require('../services/firebase');
const { sendOTPEmail } = require('../services/brevo');

/**
 * Endpoint: POST /api/auth/send-otp
 * Body: { email, name }
 */
router.post(
  '/send-otp',
  validateRequest(['email', 'name']),
  async (req, res) => {
    const { email, name } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    try {
      // 1. Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // 2. Set OTP parameters (expires in 5 minutes)
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const otpDocRef = db.collection('otps').doc(cleanEmail);

      await otpDocRef.set({
        otp,
        expiresAt,
        verified: false,
        updatedAt: Date.now()
      });

      // 3. Dispatch transactional email via Brevo
      await sendOTPEmail(cleanEmail, name, otp);

      return res.status(200).json({
        success: true,
        message: 'OTP sent to your email'
      });
    } catch (error) {
      console.error('Send OTP Error: ', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to send OTP verification email.'
      });
    }
  }
);

/**
 * Endpoint: POST /api/auth/verify-otp
 * Body: { email, otp }
 */
router.post(
  '/verify-otp',
  validateRequest(['email', 'otp']),
  async (req, res) => {
    const { email, otp } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    try {
      const otpDocRef = db.collection('otps').doc(cleanEmail);
      const docSnap = await otpDocRef.get();

      // 1. Check if document exists
      if (!docSnap.exists) {
        return res.status(404).json({
          success: false,
          message: 'OTP not found. Please request again.'
        });
      }

      const data = docSnap.data();

      // 2. Check if expired
      if (data.expiresAt < Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'OTP expired. Please request again.'
        });
      }

      // 3. Check if already verified/used
      if (data.verified) {
        return res.status(400).json({
          success: false,
          message: 'OTP already used.'
        });
      }

      // 4. Validate OTP match
      if (data.otp !== cleanOtp) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP. Please try again.'
        });
      }

      // 5. Update OTP document to verified
      await otpDocRef.update({
        verified: true,
        verifiedAt: Date.now()
      });

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully'
      });
    } catch (error) {
      console.error('Verify OTP Error: ', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal server error during verification.'
      });
    }
  }
);

module.exports = router;
