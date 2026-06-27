import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const store = useAuthStore();
  
  return {
    user: store.user,
    profile: store.profile,
    isLoading: store.isLoading,
    error: store.error,
    isBiometricsEnabled: store.isBiometricsEnabled,
    isNotificationsEnabled: store.isNotificationsEnabled,
    
    // Auth actions
    login: store.login,
    register: store.register,
    logout: store.logout,
    initAuth: store.initAuth,
    setError: store.setError,
    createUserDocument: store.createUserDocument,
    startUserListener: store.startUserListener,
    resetPassword: store.resetPassword,
    
    // Card control actions
    toggleCardFreeze: store.toggleCardFreeze,
    setCardLimit: store.setCardLimit,
    toggleCardOnlinePayments: store.toggleCardOnlinePayments,
    
    // Preferences settings
    toggleBiometrics: store.toggleBiometrics,
    toggleNotifications: store.toggleNotifications,
  };
};

export default useAuth;
