import { create } from 'zustand';
import { 
  executeTransfer, 
  executeTopUp, 
  getTransactionsHistory, 
  getSavedContacts 
} from '../services/transactions';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

export const useTransactionStore = create((set, get) => ({
  transactions: [],     // Holds user transactions list
  contacts: [],         // Quick Send contacts cache
  isLoading: false,     // Fetch/transfer loading state
  error: null,          // Transaction error state
  unsubTxSender: null,  // Holds subscription cleanup for sender listener
  unsubTxReceiver: null,// Holds subscription cleanup for receiver listener

  /**
   * Fetch user's transaction history from Firestore
   */
  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const history = await getTransactionsHistory();
      set({ transactions: history, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  /**
   * Fetch contact lists from sub-collections
   */
  fetchContacts: async () => {
    try {
      const contactList = await getSavedContacts();
      set({ contacts: contactList });
    } catch (error) {
      console.error("Fetch contacts store error: ", error);
    }
  },

  /**
   * Setup real-time listener for user's transaction history
   */
  startTransactionListener: (uid) => {
    // Unsubscribe from any active listeners first
    if (get().unsubTxSender) get().unsubTxSender();
    if (get().unsubTxReceiver) get().unsubTxReceiver();

    if (!uid) return;

    // Detect if firebase auth/database is in mock mode (using placeholder config keys)
    const isMock = db.app.options.apiKey?.includes('Placeholder') || !db.app.options.apiKey;

    if (isMock) {
      // Offline/Mock mode polling: fallback to periodic fetch to keep UI responsive
      console.log("Mock session active: starting periodic transactions poll.");
      const interval = setInterval(async () => {
        try {
          const history = await getTransactionsHistory();
          set({ transactions: history });
        } catch (e) {
          console.error(e);
        }
      }, 3000);

      const unsub = () => clearInterval(interval);
      set({ unsubTxSender: unsub, unsubTxReceiver: null });
      return;
    }

    try {
      const txRef = collection(db, 'transactions');

      const qSender = query(
        txRef,
        where('senderId', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      const qReceiver = query(
        txRef,
        where('receiverId', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      let senderTx = [];
      let receiverTx = [];

      const mergeAndSetTx = () => {
        const mergedMap = new Map();
        senderTx.forEach(tx => mergedMap.set(tx.id, tx));
        receiverTx.forEach(tx => mergedMap.set(tx.id, tx));

        const sorted = Array.from(mergedMap.values()).sort((a, b) => {
          const timeA = a.timestamp?.seconds || a.timestamp?.toMillis?.() || 0;
          const timeB = b.timestamp?.seconds || b.timestamp?.toMillis?.() || 0;
          return timeB - timeA;
        });

        set({ transactions: sorted });
      };

      const unsubSender = onSnapshot(qSender, (snapshot) => {
        senderTx = [];
        snapshot.forEach(doc => {
          senderTx.push({ id: doc.id, ...doc.data() });
        });
        mergeAndSetTx();
      }, (err) => {
        console.warn("Sender transactions snapshot listen failed:", err.message);
      });

      const unsubReceiver = onSnapshot(qReceiver, (snapshot) => {
        receiverTx = [];
        snapshot.forEach(doc => {
          receiverTx.push({ id: doc.id, ...doc.data() });
        });
        mergeAndSetTx();
      }, (err) => {
        console.warn("Receiver transactions snapshot listen failed:", err.message);
      });

      set({
        unsubTxSender: unsubSender,
        unsubTxReceiver: unsubReceiver
      });
    } catch (error) {
      console.warn("Failed to subscribe transaction queries:", error.message);
    }
  },

  /**
   * Stop real-time transaction query listener
   */
  stopTransactionListener: () => {
    if (get().unsubTxSender) get().unsubTxSender();
    if (get().unsubTxReceiver) get().unsubTxReceiver();
    set({ unsubTxSender: null, unsubTxReceiver: null });
  },

  /**
   * Transfer funds atomically using transactions services
   */
  sendMoney: async (receiverId, receiverName, amount, note) => {
    set({ isLoading: true, error: null });
    try {
      const txId = await executeTransfer(receiverId, receiverName, amount, note);
      // Refresh transactions and contacts list synchronously
      await get().fetchTransactions();
      await get().fetchContacts();
      set({ isLoading: false });
      return txId;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Top up balance using Stripe mock sheet success callback
   */
  topUp: async (amount) => {
    set({ isLoading: true, error: null });
    try {
      const txId = await executeTopUp(amount);
      await get().fetchTransactions();
      set({ isLoading: false });
      return txId;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
