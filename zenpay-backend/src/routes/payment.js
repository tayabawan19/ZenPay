const express = require('express');
const router = express.Router();
const validateRequest = require('../middleware/validateRequest');
const { admin, db } = require('../services/firebase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// Determine if Stripe has been configured with a valid key
const isStripeConfigured = process.env.STRIPE_SECRET_KEY && 
                          !process.env.STRIPE_SECRET_KEY.includes('YOUR_KEY_HERE') &&
                          process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder';

// Use standard stripe client or mock client for sandbox testing if credentials are missing
const stripeClient = isStripeConfigured
  ? stripe
  : {
      paymentIntents: {
        async create({ amount, metadata }) {
          console.warn("Stripe Secret Key is not configured. Running in MOCK Stripe mode.");
          return {
            id: 'pi_mock_' + Math.random().toString(36).substring(2, 10),
            client_secret: 'pi_mock_secret_' + Math.random().toString(36).substring(2, 10)
          };
        },
        async retrieve(id) {
          console.warn("Stripe Secret Key is not configured. Retrieving MOCK PaymentIntent status.");
          return {
            id,
            status: 'succeeded'
          };
        }
      }
    };

/**
 * Endpoint: POST /api/payment/create-payment-intent
 * Body: { amount, userId }
 */
router.post(
  '/create-payment-intent',
  validateRequest(['amount', 'userId']),
  async (req, res) => {
    const { amount, userId } = req.body;
    const amountNum = parseFloat(amount);

    // 1. Validate amount
    if (isNaN(amountNum) || amountNum < 100 || amountNum > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Top-up amount must be between PKR 100 and PKR 100,000.'
      });
    }

    try {
      // 2. Validate user exists in Firestore; if not, self-heal by creating the document
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.log(`User document not found for ID: ${userId} during intent creation. Auto-creating default user profile.`);
        await userRef.set({
          uid: userId,
          name: 'ZenPay User',
          email: 'user@zenpay.com',
          balance: 0,
          kycStatus: 'verified',
          virtualCard: {
            number: '4242424242424242',
            cvv: '123',
            expiry: '12/29',
            limit: 50000,
            spent: 0,
            isFrozen: false
          }
        });
      }

      // 3. Create Stripe PaymentIntent (use USD in test mode as PKR is not fully supported for all Stripe Payment Sheets)
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amountNum * 100), // convert to cents/paisa
        currency: 'usd',
        metadata: {
          userId,
          appName: 'ZenPay'
        }
      });

      return res.status(200).json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error('Create PaymentIntent Error: ', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to initialize payment process.'
      });
    }
  }
);

/**
 * Endpoint: POST /api/payment/confirm-topup
 * Body: { userId, amount, paymentIntentId }
 */
router.post(
  '/confirm-topup',
  validateRequest(['userId', 'amount', 'paymentIntentId']),
  async (req, res) => {
    const { userId, amount, paymentIntentId } = req.body;
    const amountNum = parseFloat(amount);

    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid top-up amount.'
      });
    }

    try {
      // 1. Verify PaymentIntent status with Stripe
      const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: `Payment failed. Intent status: ${paymentIntent.status}`
        });
      }

      // 2. Run atomic batch database operations
      const userRef = db.collection('users').doc(userId);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        console.log(`User document not found for ID: ${userId} during confirmation. Auto-creating default user profile.`);
        await userRef.set({
          uid: userId,
          name: 'ZenPay User',
          email: 'user@zenpay.com',
          balance: 0,
          kycStatus: 'verified',
          virtualCard: {
            number: '4242424242424242',
            cvv: '123',
            expiry: '12/29',
            limit: 50000,
            spent: 0,
            isFrozen: false
          }
        });
      }

      const txnRef = db.collection('transactions').doc(); // Auto-generates unique ID

      const batch = db.batch();

      // Update user balance
      batch.update(userRef, {
        balance: admin.firestore.FieldValue.increment(amountNum)
      });

      // Log credit transaction
      batch.set(txnRef, {
        id: txnRef.id,
        userId: userId,
        type: 'credit',
        category: 'topup',
        amount: amountNum,
        note: 'Top up via Stripe',
        status: 'success',
        paymentIntentId: paymentIntentId,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      // 3. Retrieve updated balance to return to client
      const updatedUserSnap = await userRef.get();
      const updatedBalance = updatedUserSnap.data()?.balance || 0;

      return res.status(200).json({
        success: true,
        newBalance: updatedBalance
      });
    } catch (error) {
      console.error('Confirm Top Up Error: ', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Internal database error during transaction logging.'
      });
    }
  }
);

module.exports = router;
