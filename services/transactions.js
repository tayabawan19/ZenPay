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
  addDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../constants/api';

const MOCK_USERS = [
  { uid: 'mock-user-1', name: 'Tayyab Tanveer', email: 'tayyab@zenpay.com', phone: '+923001234567', balance: 12000 },
  { uid: 'mock-user-2', name: 'Ayesha Khan', email: 'ayesha@zenpay.com', phone: '+923129876543', balance: 8000 },
  { uid: 'mock-user-3', name: 'Muhammad Ali', email: 'ali@zenpay.com', phone: '+923335551234', balance: 15000 },
  { uid: 'mock-user-4', name: 'Fatima Zahra', email: 'fatima@zenpay.com', phone: '+923456789012', balance: 5000 },
];

/**
 * Fetch all users from Firestore to search/select contacts (excluding current user)
 * @returns {Promise<Array>}
 */
export const searchUsers = async (query = '', currentUserId = null) => {
  const uid = currentUserId || auth.currentUser?.uid || '';
  try {
    const res = await fetch(
      `${API_URL}/api/transfer/search-users?query=${query}&currentUserId=${uid}`
    );
    return await res.json();
  } catch (error) {
    console.warn("Search Users API request failed, using local mock fallback:", error.message);
    const currentUser = auth.currentUser;
    const finalUid = uid || currentUser?.uid || '';
    if (!finalUid) return [];

    return MOCK_USERS.filter(u => 
      u.uid !== finalUid &&
      (!query || 
       u.name.toLowerCase().includes(query.toLowerCase()) || 
       u.phone.includes(query))
    );
  }
};

export const sendMoney = async (senderId, receiverId, amount, note) => {
  const res = await fetch(`${API_URL}/api/transfer/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, receiverId, amount, note })
  });
  return await res.json();
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
    
    // Save to cache
    await AsyncStorage.setItem(`zenpay_contacts_${currentUser.uid}`, JSON.stringify(contactsList));
    return contactsList;
  } catch (error) {
    console.warn("Get Saved Contacts Firestore Error, checking AsyncStorage: ", error.message);
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
export const getTransactionsHistory = async (limitVal = 50) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) return [];

    const txRef = collection(db, 'transactions');
    const qSender = query(
      txRef, 
      where('senderId', '==', currentUser.uid), 
      orderBy('timestamp', 'desc'), 
      limit(limitVal)
    );
    const qReceiver = query(
      txRef, 
      where('receiverId', '==', currentUser.uid), 
      orderBy('timestamp', 'desc'), 
      limit(limitVal)
    );

    const [senderSnap, receiverSnap] = await Promise.all([
      getDocs(qSender),
      getDocs(qReceiver)
    ]);

    const txMap = new Map();
    
    senderSnap.forEach((doc) => {
      txMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    receiverSnap.forEach((doc) => {
      txMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const txList = Array.from(txMap.values()).sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });

    // Merge or save to local transactions
    const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUser.uid}`);
    let localTx = localTxStr ? JSON.parse(localTxStr) : [];
    
    const mergedMap = new Map();
    localTx.forEach(tx => mergedMap.set(tx.id, tx));
    txList.forEach(tx => mergedMap.set(tx.id, tx));

    const finalTxList = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });

    await AsyncStorage.setItem(`zenpay_transactions_${currentUser.uid}`, JSON.stringify(finalTxList.slice(0, limitVal)));
    return finalTxList.slice(0, limitVal);
  } catch (error) {
    console.warn("Fetch Transactions Firestore Error, checking AsyncStorage: ", error.message);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const localTxStr = await AsyncStorage.getItem(`zenpay_transactions_${currentUser.uid}`);
        if (localTxStr) return JSON.parse(localTxStr);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }
};
