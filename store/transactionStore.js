import { create } from 'zustand';
import { 
  executeTransfer, 
  executeTopUp, 
  getTransactionsHistory, 
  getSavedContacts 
} from '../services/transactions';

export const useTransactionStore = create((set, get) => ({
  transactions: [],     // Holds user transactions list
  contacts: [],         // Quick Send contacts cache
  isLoading: false,     // Fetch/transfer loading state
  error: null,          // Transaction error state

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
