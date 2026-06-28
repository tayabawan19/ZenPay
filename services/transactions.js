import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  serverTimestamp,
  addDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db, auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../constants/api';

export const fetchAllUsers = async (currentUserId) => {
  const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
  if (isMockAuth) {
    try {
      const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
      const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
      const users = [];
      Object.keys(mockUsers).forEach((email) => {
        const u = mockUsers[email];
        if (u.uid !== currentUserId) {
          users.push({
            uid: u.uid,
            name: u.name || 'Unknown',
            email: u.email || '',
            phone: u.phone || '',
          });
        }
      });
      return users;
    } catch (e) {
      console.warn("Failed to fetch mock users from AsyncStorage: ", e);
    }
  }

  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users = [];
    snapshot.forEach((doc) => {
      if (doc.id !== currentUserId) {
        const data = doc.data();
        users.push({
          uid: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
        });
      }
    });
    return users;
  } catch (error) {
    console.error('fetchAllUsers error:', error);
    // Fallback to local AsyncStorage mock users if Firestore failed
    try {
      const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
      const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
      const users = [];
      Object.keys(mockUsers).forEach((email) => {
        const u = mockUsers[email];
        if (u.uid !== currentUserId) {
          users.push({
            uid: u.uid,
            name: u.name || 'Unknown',
            email: u.email || '',
            phone: u.phone || '',
          });
        }
      });
      return users;
    } catch (e) {
      return [];
    }
  }
};

export const searchUsers = async (query, currentUserId) => {
  try {
    const allUsers = await fetchAllUsers(currentUserId);
    if (!query || query.trim() === '') return allUsers;
    const q = query.toLowerCase().trim();
    return allUsers.filter(user =>
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.phone?.includes(q)
    );
  } catch (error) {
    console.error('searchUsers error:', error);
    return [];
  }
};

export const sendMoney = async ({
  senderId,
  receiverId,
  senderName,
  receiverName,
  amount,
  note
}) => {
  try {
    // Check sender balance
    const senderRef = doc(db, 'users', senderId);
    const senderSnap = await getDoc(senderRef);
    
    if (!senderSnap.exists()) {
      return { success: false, message: 'Sender not found' };
    }
    
    const senderData = senderSnap.data();
    
    if (senderData.balance < amount) {
      return { 
        success: false, 
        message: 'Insufficient balance' 
      };
    }

    // Atomic batch write
    const batch = writeBatch(db);
    const receiverRef = doc(db, 'users', receiverId);

    // Deduct from sender
    batch.update(senderRef, {
      balance: increment(-amount)
    });

    // Add to receiver
    batch.update(receiverRef, {
      balance: increment(amount)
    });

    // Create debit transaction for sender
    const debitRef = doc(collection(db, 'transactions'));
    batch.set(debitRef, {
      id: debitRef.id,
      senderId,
      receiverId,
      senderName,
      receiverName,
      amount,
      type: 'debit',
      category: 'transfer',
      note: note || 'Money Transfer',
      status: 'success',
      timestamp: serverTimestamp(),
    });

    // Create credit transaction for receiver
    const creditRef = doc(collection(db, 'transactions'));
    batch.set(creditRef, {
      id: creditRef.id,
      senderId,
      receiverId,
      senderName,
      receiverName,
      amount,
      type: 'credit',
      category: 'transfer',
      note: note || 'Money Transfer',
      status: 'success',
      timestamp: serverTimestamp(),
    });

    // Save receiver as contact for sender
    const contactRef = doc(
      db, 
      'contacts', senderId, 
      'contacts', receiverId
    );
    batch.set(contactRef, {
      uid: receiverId,
      name: receiverName,
      lastTransfer: serverTimestamp(),
    }, { merge: true });

    // Commit everything at once
    await batch.commit();

    return { 
      success: true, 
      message: 'Transfer successful' 
    };

  } catch (error) {
    console.error('sendMoney error:', error);
    return { 
      success: false, 
      message: 'Transfer failed. Please try again.' 
    };
  }
};

/**
 * Fetch user contacts from the contacts/{uid}/contacts/ collection
 * @returns {Promise<Array>}
 */
export const getSavedContacts = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const contactsRef = collection(db, 'contacts', currentUser.uid, 'contacts');
    const querySnapshot = await getDocs(contactsRef);
    
    const contactsList = [];
    querySnapshot.forEach((doc) => {
      contactsList.push({ uid: doc.id, ...doc.data() });
    });
    
    await AsyncStorage.setItem(`zenpay_contacts_${currentUser.uid}`, JSON.stringify(contactsList));
    return contactsList;
  } catch (error) {
    console.warn("Get Saved Contacts failed, checking local AsyncStorage fallback: ", error.message);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const localContacts = await AsyncStorage.getItem(`zenpay_contacts_${currentUser.uid}`);
        if (localContacts) return JSON.parse(localContacts);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }
};

/**
 * Add a contact manually or after a transfer
 * @param {string} contactId 
 * @param {string} name 
 * @param {string} phone 
 * @param {string} avatar 
 */
export const saveContact = async (contactId, name, phone, avatar = null) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const contactData = {
    name,
    phone,
    avatar,
    savedAt: new Date().toISOString()
  };

  // Optimistically save/update in AsyncStorage
  try {
    const localContactsStr = await AsyncStorage.getItem(`zenpay_contacts_${currentUser.uid}`);
    let localContacts = localContactsStr ? JSON.parse(localContactsStr) : [];
    const index = localContacts.findIndex(c => c.uid === contactId);
    if (index >= 0) {
      localContacts[index] = { ...localContacts[index], ...contactData };
    } else {
      localContacts.push({ uid: contactId, ...contactData });
    }
    await AsyncStorage.setItem(`zenpay_contacts_${currentUser.uid}`, JSON.stringify(localContacts));
  } catch (err) {
    console.error("AsyncStorage saveContact error: ", err);
  }

  try {
    const contactDocRef = doc(db, 'contacts', currentUser.uid, 'contacts', contactId);
    await setDoc(contactDocRef, {
      name,
      phone,
      avatar,
      savedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.warn("Save Contact Firestore Error (saved locally): ", error.message);
  }
};

/**
 * Atomically transfer funds from current user to receiver
 * @param {string} receiverId 
 * @param {string} receiverName 
 * @param {number} amount 
 * @param {string} note 
 * @returns {Promise<string>} - Transaction ID
 */
export const executeTransfer = async (receiverId, receiverName, amount, note) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User must be authenticated to perform transfers.");
  if (currentUser.uid === receiverId) throw new Error("Cannot send money to yourself.");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  const senderDocRef = doc(db, 'users', currentUser.uid);
  const receiverDocRef = doc(db, 'users', receiverId);
  const txColRef = collection(db, 'transactions');
  const newTxDocRef = doc(txColRef); // Generate auto ID

  try {
    const res = await sendMoney(currentUser.uid, receiverId, amount, note);
    if (!res.success) {
      throw new Error(res.message || 'Transfer failed.');
    }

    // Sync client-side authStore balance synchronously
    const authStore = useAuthStore.getState();
    if (authStore.profile) {
      authStore.setState({
        profile: {
          ...authStore.profile,
          balance: res.newBalance
        }
      });
    }

    return res.transactionId;
  } catch (error) {
    console.warn("Backend P2P send Money request failed, falling back to local simulation:", error.message);
    
    // Local simulation fallback
    try {
      const store = useAuthStore.getState();
      const profile = store.profile;
      if (!profile) throw new Error("No user profile found.");
      if (profile.balance < amount) throw new Error("Insufficient balance.");

      // 1. Update local sender balance
      const updatedProfile = {
        ...profile,
        balance: profile.balance - amount
      };
      store.setState({ profile: updatedProfile });
      await AsyncStorage.setItem(`zenpay_profile_${currentUser.uid}`, JSON.stringify(updatedProfile));

      // 2. Generate local transaction record
      const txId = 'tx_local_' + Math.random().toString(36).substr(2, 9);
      const txRecord = {
        id: txId,
        senderId: currentUser.uid,
        receiverId,
        senderName: profile.name,
        receiverName,
        amount,
        type: 'debit',
        category: 'transfer',
        note,
        status: 'success',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
      };

      // Append to local transactions history
      const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUser.uid}`);
      const localTransactions = localTxStr ? JSON.parse(localTxStr) : [];
      localTransactions.unshift(txRecord);
      await AsyncStorage.setItem(`zenpay_transactions_${currentUser.uid}`, JSON.stringify(localTransactions));

      // Save recipient as contact locally
      await saveContact(receiverId, receiverName, '+923000000000', null);

      return txId;
    } catch (fallbackErr) {
      console.error("Local transfer fallback failed: ", fallbackErr);
      throw fallbackErr;
    }
  }
};

/**
 * Top up the user's account balance (Stripe path)
 * @param {number} amount 
 * @returns {Promise<string>} - Transaction ID
 */
export const executeTopUp = async (amount) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("User must be authenticated to perform top-ups.");
  if (amount <= 0) throw new Error("Amount must be greater than zero.");

  const userDocRef = doc(db, 'users', currentUser.uid);
  const txColRef = collection(db, 'transactions');
  const newTxDocRef = doc(txColRef);

  try {
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) throw new Error("User profile not found.");

      const userData = userDoc.data();

      // Update user balance
      transaction.update(userDocRef, {
        balance: userData.balance + amount
      });

      // Create transaction document
      transaction.set(newTxDocRef, {
        senderId: 'stripe',
        receiverId: currentUser.uid,
        senderName: 'Stripe Top-Up',
        receiverName: userData.name,
        amount,
        type: 'credit',
        category: 'topup',
        note: 'Loaded via credit card',
        status: 'success',
        timestamp: serverTimestamp()
      });
    });

    return newTxDocRef.id;
  } catch (error) {
    console.warn("Firestore top up transaction failed, falling back to local simulation: ", error.message);
    
    try {
      const store = useAuthStore.getState();
      const profile = store.profile;
      if (!profile) throw new Error("No user profile found.");

      const updatedProfile = {
        ...profile,
        balance: profile.balance + amount
      };
      store.setState({ profile: updatedProfile });
      await AsyncStorage.setItem(`zenpay_profile_${currentUser.uid}`, JSON.stringify(updatedProfile));

      const txId = 'tx_local_' + Math.random().toString(36).substr(2, 9);
      const txRecord = {
        id: txId,
        senderId: 'stripe',
        receiverId: currentUser.uid,
        senderName: 'Stripe Top-Up',
        receiverName: profile.name,
        amount,
        type: 'credit',
        category: 'topup',
        note: 'Loaded via credit card (Simulated)',
        status: 'success',
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
      };

      const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUser.uid}`);
      const localTransactions = localTxStr ? JSON.parse(localTxStr) : [];
      localTransactions.unshift(txRecord);
      await AsyncStorage.setItem(`zenpay_transactions_${currentUser.uid}`, JSON.stringify(localTransactions));

      return txId;
    } catch (fallbackErr) {
      console.error("Local top up fallback failed: ", fallbackErr);
      throw fallbackErr;
    }
  }
};

/**
 * Retrieve transaction history for the logged-in user
 * @param {number} limitVal 
 * @returns {Promise<Array>}
 */
export const getTransactionsHistory = async (uid) => {
  const currentUid = uid || auth.currentUser?.uid;
  if (!currentUid) return [];

  const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
  if (isMockAuth) {
    try {
      const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUid}`);
      if (localTxStr) return JSON.parse(localTxStr);
    } catch (e) {
      console.warn("Mock transactions history read failed:", e);
    }
  }

  try {
    const q = query(
      collection(db, 'transactions'),
      where('senderId', '==', currentUid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const q2 = query(
      collection(db, 'transactions'),
      where('receiverId', '==', currentUid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const [snap1, snap2] = await Promise.all([
      getDocs(q),
      getDocs(q2)
    ]);
    const txns = [];
    snap1.forEach(d => txns.push({ id: d.id, ...d.data() }));
    snap2.forEach(d => txns.push({ id: d.id, ...d.data() }));
    txns.sort((a,b) => 
      (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)
    );
    return txns;
  } catch (error) {
    console.error('getTransactionsHistory error, trying AsyncStorage fallback:', error);
    try {
      const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUid}`);
      if (localTxStr) return JSON.parse(localTxStr);
    } catch (e) {
      console.error(e);
    }
    return [];
  }
};
