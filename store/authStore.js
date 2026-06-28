import { create } from 'zustand';
import { loginUser, registerUser, logoutUser, sendPasswordReset } from '../services/auth';
import { auth, db, onAuthStateChanged, signOut } from '../services/firebase';
import { doc, onSnapshot, updateDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useTransactionStore } from './transactionStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants/api';

export const useAuthStore = create((set, get) => ({
  user: null,                   // Firebase Auth User object
  profile: null,                // User profile document from Firestore
  isLoading: true,              // Global authentication loading state
  error: null,                  // Login or registration error messages
  isBiometricsEnabled: false,    // Bio-authentication setting state
  isNotificationsEnabled: true, // App notification setting state
  isPinVerified: false,         // Session PIN verified status
  unsubProfileListener: null,   // Holds the onSnapshot cleanup function

  syncProfileWithBackend: async (profileData) => {
    if (!profileData || !profileData.uid) return;
    try {
      await fetch(`${API_URL}/api/auth/sync-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: profileData.uid,
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          balance: profileData.balance,
          virtualCard: profileData.virtualCard
        })
      });
    } catch (e) {
      console.warn("Failed to sync profile to backend database:", e.message);
    }
  },

  fetchProfile: async (uid) => {
    if (!uid) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/profile?uid=${uid}`);
      const data = await res.json();
      if (data.success && data.profile) {
        set({ profile: data.profile });
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify(data.profile));
      } else {
        throw new Error("API profile fetch was unsuccessful");
      }
    } catch (e) {
      console.warn("Failed to fetch profile from backend database, checking AsyncStorage fallback:", e.message);
      try {
        const localProfile = await AsyncStorage.getItem(`zenpay_profile_${uid}`);
        if (localProfile) {
          set({ profile: JSON.parse(localProfile) });
        }
      } catch (err) {
        console.error("Local profile fetch error:", err);
      }
    }
  },

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
        
        const isMock = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
        if (isMock) {
          console.log("Mock session active: loading profile from AsyncStorage.");
          try {
            const localData = await AsyncStorage.getItem(`zenpay_profile_${firebaseUser.uid}`);
            if (localData) {
              const profileData = JSON.parse(localData);
              set({ profile: profileData, isLoading: false });
              get().syncProfileWithBackend(profileData);
              get().fetchProfile(firebaseUser.uid);
            } else {
              // Create local default profile if none exists
              const defaultProfile = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'ZenPay User',
                email: firebaseUser.email,
                phone: '+923000000000',
                balance: 10000,
                kycStatus: 'verified',
                virtualCard: {
                  number: '4242 4242 4242 4242',
                  expiry: '12/28',
                  cvv: '123',
                  limit: 50000,
                  spent: 0,
                  isActive: true,
                  onlinePayments: true,
                }
              };
              await AsyncStorage.setItem(`zenpay_profile_${firebaseUser.uid}`, JSON.stringify(defaultProfile));
              set({ profile: defaultProfile, isLoading: false });
              get().syncProfileWithBackend(defaultProfile);
            }
          } catch (e) {
            console.error("Local profile fetch/create error:", e);
            set({ profile: null, isLoading: false });
          }
          return;
        }

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
      
      // Sync profile to backend
      get().syncProfileWithBackend(profileData);
      // Fetch latest profile balance from backend
      get().fetchProfile(user.uid);
      
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
  register: async (fullName, email, phoneNumber, password) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Firebase createUserWithEmailAndPassword succeeds
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Immediately create a Firestore document at /users/{uid}
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: fullName,
          email: email.toLowerCase().trim(),
          phone: phoneNumber,
          balance: 0,
          createdAt: serverTimestamp(),
          kycStatus: 'pending',
          virtualCard: {
            number: '4242 4242 4242 4242',
            expiry: '12/28',
            cvv: '123',
            limit: 50000,
            spent: 0,
            isActive: true,
            isFrozen: false,
          }
        });
      } catch (setDocErr) {
        // If setDoc fails -> delete the Firebase Auth user and show error
        await userCredential.user.delete();
        throw new Error("Account creation failed. Please try again.");
      }

      // 2. Update Zustand authStore
      set({
        user: {
          uid: userCredential.user.uid,
          name: fullName,
          email: email,
          phone: phoneNumber,
          balance: 0,
        },
        isAuthenticated: true,
      });

      // 3. Start real-time listener immediately after register
      const uid = userCredential.user.uid;
      const userRef = doc(db, 'users', uid);
      const unsubscribe = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({ 
            user: { ...get().user, ...data },
            balance: data.balance,
            profile: data // Also update the profile field so the Home/Balance card works!
          });
        }
      });
      set({ unsubscribeUser: unsubscribe });

      set({ isLoading: false });
      return userCredential.user;

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
          isFrozen: false,
          onlinePayments: true,
        }
      };
      
      try {
        await setDoc(userDocRef, userData);
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify({
          ...userData,
          createdAt: new Date().toISOString()
        }));
        // Sync profile to backend
        await get().syncProfileWithBackend(userData);
      } catch (fsErr) {
        console.warn("Firestore user doc create failed, using AsyncStorage fallback: ", fsErr.message);
        const localData = {
          ...userData,
          createdAt: new Date().toISOString()
        };
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify(localData));
        // Sync profile to backend fallback
        await get().syncProfileWithBackend(localData);
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
    const existingUnsub = get().unsubscribeUser || get().unsubProfileListener;
    if (existingUnsub) {
      existingUnsub();
    }

    const isMock = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
    if (isMock) {
      console.log("Mock session active: skip real-time profile listener.");
      // Just fetch local profile once
      AsyncStorage.getItem(`zenpay_profile_${uid}`).then((localData) => {
        if (localData) {
          const parsed = JSON.parse(localData);
          set({ 
            profile: parsed, 
            user: { ...get().user, balance: parsed.balance },
            balance: parsed.balance,
            isLoading: false 
          });
        }
      });
      const unsubscribeDummy = () => {};
      set({ 
        unsubProfileListener: unsubscribeDummy,
        unsubscribeUser: unsubscribeDummy 
      });
      return unsubscribeDummy;
    }

    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({ 
          user: { ...get().user, balance: data.balance },
          balance: data.balance,
          profile: data, 
          isLoading: false 
        });
        AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify(data)).catch(console.error);
        // Sync profile to backend
        get().syncProfileWithBackend(data);
      } else {
        AsyncStorage.getItem(`zenpay_profile_${uid}`).then((localData) => {
          if (localData) {
            const parsed = JSON.parse(localData);
            set({ 
              profile: parsed, 
              user: { ...get().user, balance: parsed.balance },
              balance: parsed.balance,
              isLoading: false 
            });
            // Sync with backend
            get().syncProfileWithBackend(parsed);
            // Fetch latest balance from backend
            get().fetchProfile(uid);
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
          const parsed = JSON.parse(localData);
          set({ 
            profile: parsed, 
            user: { ...get().user, balance: parsed.balance },
            balance: parsed.balance,
            isLoading: false 
          });
          // Sync with backend
          get().syncProfileWithBackend(parsed);
          // Fetch latest balance from backend
          get().fetchProfile(uid);
          return;
        }
      } catch (storageErr) {
        console.error("AsyncStorage profile read error: ", storageErr);
      }
      set({ error: err.message, isLoading: false });
    });

    set({ 
      unsubProfileListener: unsubscribe,
      unsubscribeUser: unsubscribe 
    });
    return unsubscribe;
  },

  /**
   * Log out user
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      // Clear real-time transaction query listener
      useTransactionStore.getState().stopTransactionListener();

      get().unsubscribeUser?.();

      const existingUnsub = get().unsubProfileListener;
      if (existingUnsub) {
        existingUnsub();
      }
      await logoutUser();
      set({ 
        user: null, 
        profile: null, 
        balance: 0,
        unsubProfileListener: null, 
        unsubscribeUser: null,
        isPinVerified: false,
        isLoading: false 
      });
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
    const updatedStatus = !profile.virtualCard.isFrozen;

    const updatedProfile = {
      ...profile,
      virtualCard: {
        ...profile.virtualCard,
        isFrozen: updatedStatus
      }
    };
    set({ profile: updatedProfile });
    await AsyncStorage.setItem(`zenpay_profile_${profile.uid}`, JSON.stringify(updatedProfile)).catch(console.error);
    get().syncProfileWithBackend(updatedProfile);

    try {
      await updateDoc(userDocRef, {
        'virtualCard.isFrozen': updatedStatus
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
    get().syncProfileWithBackend(updatedProfile);

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
    get().syncProfileWithBackend(updatedProfile);

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
  setPinVerified: (value) => set({ isPinVerified: value }),
}));
