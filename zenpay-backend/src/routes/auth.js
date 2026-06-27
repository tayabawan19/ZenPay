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

/**
 * Endpoint: POST /api/auth/sync-profile
 * Body: { uid, name, email, phone, balance }
 */
router.post('/sync-profile', async (req, res) => {
  const { uid, name, email, phone, balance } = req.body;
  if (!uid) {
    return res.status(400).json({ success: false, message: 'uid is required.' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const docSnap = await userRef.get();

    const currentBalance = docSnap.exists ? (docSnap.data().balance || 0) : (balance !== undefined ? balance : 10000);

    const profileData = {
      uid,
      name: name || (docSnap.exists ? docSnap.data().name : 'ZenPay User'),
      email: email || (docSnap.exists ? docSnap.data().email : ''),
      phone: phone || (docSnap.exists ? docSnap.data().phone : ''),
      balance: currentBalance,
      kycStatus: 'verified',
      virtualCard: {
        number: '4242 4242 4242 4242',
        expiry: '12/28',
        cvv: '123',
        limit: 50000,
        spent: 0,
        isActive: true,
        onlinePayments: true
      }
    };

    await userRef.set(profileData);
    return res.status(200).json({ success: true, profile: profileData });
  } catch (error) {
    console.error('Sync Profile Error: ', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Endpoint: GET /api/auth/profile
 * Query: ?uid=xxx
 */
router.get('/profile', async (req, res) => {
  const { uid } = req.query;
  if (!uid) {
    return res.status(400).json({ success: false, message: 'uid is required.' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const docSnap = await userRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    return res.status(200).json({ success: true, profile: docSnap.data() });
  } catch (error) {
    console.error('Fetch Profile Error: ', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
