import { useTransactionStore } from '../store/transactionStore';

export const useTransactions = () => {
  const store = useTransactionStore();
  
  return {
    transactions: store.transactions,
    contacts: store.contacts,
    isLoading: store.isLoading,
    error: store.error,
    
    // Actions
    fetchTransactions: store.fetchTransactions,
    fetchContacts: store.fetchContacts,
    sendMoney: store.sendMoney,
    topUp: store.topUp,
  };
};

export default useTransactions;
