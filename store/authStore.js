import { create } from 'zustand';
import { loginUser, registerUser, logoutUser, sendPasswordReset } from '../services/auth';
import { auth, db, onAuthStateChanged, signOut } from '../services/firebase';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useTransactionStore } from './transactionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create((set, get) => ({
  user: null,                   // Firebase Auth User object
  profile: null,                // User profile document from Firestore
  isLoading: true,              // Global authentication loading state
  error: null,                  // Login or registration error messages
  isBiometricsEnabled: false,    // Bio-authentication setting state
  isNotificationsEnabled: true, // App notification setting state
  unsubProfileListener: null,   // Holds the onSnapshot cleanup function

  setError: (error) => set({ error }),
  setLoading: (isLoading) => set({ isLoading }),

  /**
   * Listen to Firebase auth changes and sync profile in real-time from Firestore.
   * Returns an unsubscribe function.
   */
  initAuth: () => {
    set({ isLoading: true });
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clear any existing profile subscription first
      const existingUnsub = get().unsubProfileListener;
      if (existingUnsub) {
        existingUnsub();
      }

      if (firebaseUser) {
        set({ user: firebaseUser });
        // Start real-time transaction listener
        useTransactionStore.getState().startTransactionListener(firebaseUser.uid);
        
        // Setup real-time listener for current user's profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            set({ profile: data, isLoading: false });
            AsyncStorage.setItem(`zenpay_profile_${firebaseUser.uid}`, JSON.stringify(data)).catch(console.error);
          } else {
            // Check if profile exists locally
            AsyncStorage.getItem(`zenpay_profile_${firebaseUser.uid}`).then((localData) => {
              if (localData) {
                set({ profile: JSON.parse(localData), isLoading: false });
              } else {
                set({ profile: null, isLoading: false });
                signOut(auth).catch(console.error);
              }
            }).catch(() => {
              set({ profile: null, isLoading: false });
              signOut(auth).catch(console.error);
            });
          }
        }, async (err) => {
          console.warn("Firestore real-time profile listen error: ", err.message);
          // Try loading from AsyncStorage
          try {
            const localData = await AsyncStorage.getItem(`zenpay_profile_${firebaseUser.uid}`);
            if (localData) {
              set({ profile: JSON.parse(localData), isLoading: false });
              return;
            }
          } catch (storageErr) {
            console.error("AsyncStorage profile read error: ", storageErr);
          }
          set({ error: err.message, isLoading: false });
        });

        set({ unsubProfileListener: unsubProfile });
      } else {
        set({ user: null, profile: null, unsubProfileListener: null, isLoading: false });
      }
    });

    return unsubscribe;
  },

  /**
   * Log in user
   */
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await loginUser(email, password);
      
      let profileData = null;
      try {
        // Fetch user document from Firestore /users/{uid}
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          profileData = userSnap.data();
          await AsyncStorage.setItem(`zenpay_profile_${user.uid}`, JSON.stringify(profileData));
        }
      } catch (getDocErr) {
        console.warn("Firestore profile get failed during login, checking local storage: ", getDocErr.message);
      }

      if (!profileData) {
        // Try fetching from AsyncStorage
        const localData = await AsyncStorage.getItem(`zenpay_profile_${user.uid}`);
        if (localData) {
          profileData = JSON.parse(localData);
        }
      }
      
      if (!profileData) {
        // Sign out if profile doesn't exist
        await get().logout();
        throw { code: 'custom/user-document-not-found', message: "Account data not found. Please register again." };
      }
      
      // Store user data in Zustand authStore
      set({ user, profile: profileData });
      
      // Start real-time profile listener
      get().startUserListener(user.uid);
      
      // Start real-time transaction listener
      useTransactionStore.getState().startTransactionListener(user.uid);
      
      return user;
    } catch (error) {
      let userFriendlyMsg = error.message;
      if (error.code) {
        switch (error.code) {
          case 'auth/wrong-password':
            userFriendlyMsg = "Incorrect password. Please try again.";
            break;
          case 'auth/user-not-found':
            userFriendlyMsg = "No account found with this email.";
            break;
          case 'auth/too-many-requests':
            userFriendlyMsg = "Too many failed attempts. Please try again later.";
            break;
          case 'auth/invalid-email':
            userFriendlyMsg = "Please enter a valid email address.";
            break;
          case 'auth/network-request-failed':
            userFriendlyMsg = "Network error. Check your internet connection.";
            break;
          case 'custom/user-document-not-found':
            userFriendlyMsg = "Account data not found. Please register again.";
            break;
        }
      }
      set({ error: userFriendlyMsg, isLoading: false });
      throw new Error(userFriendlyMsg);
    }
  },

  /**
   * Reset user password via email link
   */
  resetPassword: async (email) => {
    set({ isLoading: true, error: null });
    try {
      await sendPasswordReset(email);
      set({ isLoading: false });
    } catch (error) {
      let userFriendlyMsg = error.message;
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
            userFriendlyMsg = "No account found with this email.";
            break;
          case 'auth/invalid-email':
            userFriendlyMsg = "Please enter a valid email address.";
            break;
          case 'auth/network-request-failed':
            userFriendlyMsg = "Network error. Check your internet connection.";
            break;
        }
      }
      set({ error: userFriendlyMsg, isLoading: false });
      throw new Error(userFriendlyMsg);
    }
  },

  /**
   * Register user
   */
  register: async (name, email, phone, password) => {
    set({ isLoading: true, error: null });
    try {
      const user = await registerUser(name, email, phone, password);
      return user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Create user profile document in Firestore
   */
  createUserDocument: async (uid, name, email, phone) => {
    set({ isLoading: true, error: null });
    try {
      const userDocRef = doc(db, 'users', uid);
      const userData = {
        uid,
        name,
        email,
        phone,
        balance: 10000, // PKR 10,000 demo balance
        avatar: null,
        createdAt: serverTimestamp(),
        virtualCard: {
          number: '4242 4242 4242 4242', // Stripe test card
          expiry: '12/28',
          cvv: '123',
          limit: 50000,
          spent: 0,
          isActive: true,
          onlinePayments: true,
        }
      };
      
      try {
        await setDoc(userDocRef, userData);
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify({
          ...userData,
          createdAt: new Date().toISOString()
        }));
      } catch (fsErr) {
        console.warn("Firestore user doc create failed, using AsyncStorage fallback: ", fsErr.message);
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify({
          ...userData,
          createdAt: new Date().toISOString()
        }));
      }
      
      set({ isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Start user listener for profile syncing
   */
  startUserListener: (uid) => {
    const existingUnsub = get().unsubProfileListener;
    if (existingUnsub) {
      existingUnsub();
    }

    const userDocRef = doc(db, 'users', uid);
    const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ profile: data, isLoading: false });
        AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify(data)).catch(console.error);
      } else {
        AsyncStorage.getItem(`zenpay_profile_${uid}`).then((localData) => {
          if (localData) {
            set({ profile: JSON.parse(localData), isLoading: false });
          } else {
            set({ profile: null, isLoading: false });
          }
        }).catch(() => {
          set({ profile: null, isLoading: false });
        });
      }
    }, async (err) => {
      console.warn("Firestore real-time profile listen error: ", err.message);
      try {
        const localData = await AsyncStorage.getItem(`zenpay_profile_${uid}`);
        if (localData) {
          set({ profile: JSON.parse(localData), isLoading: false });
          return;
        }
      } catch (storageErr) {
        console.error("AsyncStorage profile read error: ", storageErr);
      }
      set({ error: err.message, isLoading: false });
    });

    set({ unsubProfileListener: unsubProfile });
    return unsubProfile;
  },

  /**
   * Log out user
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      // Clear real-time transaction query listener
      useTransactionStore.getState().stopTransactionListener();

      const existingUnsub = get().unsubProfileListener;
      if (existingUnsub) {
        existingUnsub();
      }
      await logoutUser();
      set({ user: null, profile: null, unsubProfileListener: null, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  /**
   * Freeze/Unfreeze debit card in Firestore
   */
  toggleCardFreeze: async () => {
    const { profile } = get();
    if (!profile) return;
    const userDocRef = doc(db, 'users', profile.uid);
    const updatedStatus = !profile.virtualCard.isActive;

    const updatedProfile = {
      ...profile,
      virtualCard: {
        ...profile.virtualCard,
        isActive: updatedStatus
      }
    };
    set({ profile: updatedProfile });
    await AsyncStorage.setItem(`zenpay_profile_${profile.uid}`, JSON.stringify(updatedProfile)).catch(console.error);

    try {
      await updateDoc(userDocRef, {
        'virtualCard.isActive': updatedStatus
      });
    } catch (error) {
      console.warn("Toggle Card Freeze Firestore Error (saved locally): ", error.message);
    }
  },

  /**
   * Set card spending limit
   */
  setCardLimit: async (limitAmount) => {
    const { profile } = get();
    if (!profile) return;
    const userDocRef = doc(db, 'users', profile.uid);
    
    const updatedProfile = {
      ...profile,
      virtualCard: {
        ...profile.virtualCard,
        limit: limitAmount
      }
    };
    set({ profile: updatedProfile });
    await AsyncStorage.setItem(`zenpay_profile_${profile.uid}`, JSON.stringify(updatedProfile)).catch(console.error);

    try {
      await updateDoc(userDocRef, {
        'virtualCard.limit': limitAmount
      });
    } catch (error) {
      console.warn("Set Card Limit Firestore Error (saved locally): ", error.message);
    }
  },

  /**
   * Toggle card online payments permission
   */
  toggleCardOnlinePayments: async () => {
    const { profile } = get();
    if (!profile) return;
    const userDocRef = doc(db, 'users', profile.uid);
    const updatedStatus = !profile.virtualCard.onlinePayments;

    const updatedProfile = {
      ...profile,
      virtualCard: {
        ...profile.virtualCard,
        onlinePayments: updatedStatus
      }
    };
    set({ profile: updatedProfile });
    await AsyncStorage.setItem(`zenpay_profile_${profile.uid}`, JSON.stringify(updatedProfile)).catch(console.error);

    try {
      await updateDoc(userDocRef, {
        'virtualCard.onlinePayments': updatedStatus
      });
    } catch (error) {
      console.warn("Toggle Online Payments Firestore Error (saved locally): ", error.message);
    }
  },

  /**
   * Update settings locally
   */
  toggleBiometrics: (value) => set({ isBiometricsEnabled: value }),
  toggleNotifications: (value) => set({ isNotificationsEnabled: value }),
}));
