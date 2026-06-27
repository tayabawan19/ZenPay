const express = require('express');
const router = express.Router();
const validateRequest = require('../middleware/validateRequest');
const { admin, db } = require('../services/firebase');

/**
 * Endpoint: GET /api/transfer/search-users?query=xxx&currentUserId=yyy
 */
router.get('/search-users', async (req, res) => {
  const { query, currentUserId } = req.query;
  const searchQuery = (query || '').toLowerCase().trim();

  try {
    let usersSnap = await db.collection('users').get();
    
    // Auto-seed mock users if database is empty/newly initialized (1 or fewer profiles exist)
    const docsArray = [];
    usersSnap.forEach(doc => docsArray.push({ id: doc.id, ...doc.data() }));

    if (docsArray.length <= 1) {
      console.log("Database has 1 or fewer users. Seeding default mock contacts for test mode.");
      const seedUsers = [
        { uid: 'mock-user-1', name: 'Tayyab Tanveer', email: 'tayyab@zenpay.com', phone: '+923001234567', balance: 12000 },
        { uid: 'mock-user-2', name: 'Ayesha Khan', email: 'ayesha@zenpay.com', phone: '+923129876543', balance: 8000 },
        { uid: 'mock-user-3', name: 'Muhammad Ali', email: 'ali@zenpay.com', phone: '+923335551234', balance: 15000 },
        { uid: 'mock-user-4', name: 'Fatima Zahra', email: 'fatima@zenpay.com', phone: '+923456789012', balance: 5000 }
      ];

      for (const u of seedUsers) {
        if (u.uid !== currentUserId) {
          await db.collection('users').doc(u.uid).set({
            uid: u.uid,
            name: u.name,
            email: u.email,
            phone: u.phone,
            balance: u.balance,
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
      }
      // Re-query database after seeding
      usersSnap = await db.collection('users').get();
    }

    const results = [];
    usersSnap.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;

      // Exclude the current user from searches
      if (uid === currentUserId) return;

      const name = (data.name || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const phone = (data.phone || '').toLowerCase();

      // Check if keyword matches name, email, or phone
      if (name.includes(searchQuery) || email.includes(searchQuery) || phone.includes(searchQuery)) {
        results.push({
          uid,
          name: data.name || 'ZenPay User',
          email: data.email || '',
          phone: data.phone || ''
          // Note: balance field is explicitly omitted for security/privacy
        });
      }
    });

    return res.status(200).json(results.slice(0, 10));
  } catch (error) {
    console.error('Search Users Error: ', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to search users.'
    });
  }
});

/**
 * Endpoint: POST /api/transfer/send
 * Body: { senderId, receiverId, amount, note }
 */
router.post(
  '/send',
  validateRequest(['senderId', 'receiverId', 'amount']),
  async (req, res) => {
    const { senderId, receiverId, amount, note } = req.body;
    const amountNum = parseFloat(amount);

    // 1. Validations
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transfer amount must be greater than zero.'
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot transfer money to yourself.'
      });
    }

    try {
      const senderRef = db.collection('users').doc(senderId);
      const receiverRef = db.collection('users').doc(receiverId);

      let senderSnap = await senderRef.get();
      let receiverSnap = await receiverRef.get();

      // Self-heal: auto-create sender if not exists in Firestore (for testing/mock mode)
      if (!senderSnap.exists) {
        console.log(`Sender document not found for ID: ${senderId}. Auto-creating it.`);
        await senderRef.set({
          uid: senderId,
          name: 'Sender User',
          email: 'sender@zenpay.com',
          balance: 10000, // Give them starting balance to test sending!
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
        senderSnap = await senderRef.get();
      }

      // Self-heal: auto-create receiver if not exists in Firestore
      if (!receiverSnap.exists) {
        console.log(`Receiver document not found for ID: ${receiverId}. Auto-creating it.`);
        await receiverRef.set({
          uid: receiverId,
          name: 'Receiver User',
          email: 'receiver@zenpay.com',
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
        receiverSnap = await receiverRef.get();
      }

      const senderData = senderSnap.data();
      const receiverData = receiverSnap.data();

      // 2. Validate sender balance
      if ((senderData.balance || 0) < amountNum) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }

      // 3. Execute atomic Firestore batch write
      const batch = db.batch();

      // Deduct from sender
      batch.update(senderRef, {
        balance: admin.firestore.FieldValue.increment(-amountNum)
      });

      // Add to receiver
      batch.update(receiverRef, {
        balance: admin.firestore.FieldValue.increment(amountNum)
      });

      // Create debit transaction for sender
      const debitRef = db.collection('transactions').doc();
      batch.set(debitRef, {
        id: debitRef.id,
        senderId,
        receiverId,
        senderName: senderData.name || 'ZenPay User',
        receiverName: receiverData.name || 'ZenPay User',
        amount: amountNum,
        type: 'debit',
        category: 'transfer',
        note: note || 'Money Transfer',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Create credit transaction for receiver
      const creditRef = db.collection('transactions').doc();
      batch.set(creditRef, {
        id: creditRef.id,
        senderId,
        receiverId,
        senderName: senderData.name || 'ZenPay User',
        receiverName: receiverData.name || 'ZenPay User',
        amount: amountNum,
        type: 'credit',
        category: 'transfer',
        note: note || 'Money Transfer',
        status: 'success',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // Save recipient contact for sender convenience
      const contactRef = db
        .collection('contacts')
        .doc(senderId)
        .collection('contacts')
        .doc(receiverId);

      batch.set(contactRef, {
        uid: receiverId,
        name: receiverData.name || 'ZenPay User',
        phone: receiverData.phone || '+923000000000',
        lastTransfer: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      // 4. Retrieve updated sender balance to return to client
      const updatedSenderSnap = await senderRef.get();
      const senderNewBalance = updatedSenderSnap.data()?.balance || 0;

      return res.status(200).json({
        success: true,
        message: 'Transfer successful',
        newBalance: senderNewBalance,
        transactionId: debitRef.id
      });

    } catch (error) {
      console.error('Transfer Execution Error: ', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Transaction failed.'
      });
    }
  }
);

module.exports = router;
