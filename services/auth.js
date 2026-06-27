import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Send password reset email
 * @param {string} email 
 * @returns {Promise<void>}
 */
export const sendPasswordReset = async (email) => {
  const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
  if (isMockAuth) {
    console.warn("Mock auth mode: password reset requested for " + email);
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key-not-valid')) {
      console.warn("Firebase API key invalid. Mocking password reset email dispatch.");
      auth._isMock = true;
      return;
    }
    console.error("Password Reset Error: ", error);
    throw error;
  }
};

/**
 * Log in a user with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<User>}
 */
export const loginUser = async (email, password) => {
  const cleanEmail = email.toLowerCase().trim();
  const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;

  if (isMockAuth) {
    const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
    const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
    const localUser = mockUsers[cleanEmail];
    if (localUser && localUser.password === password) {
      const user = {
        uid: localUser.uid,
        email: localUser.email,
        displayName: localUser.name
      };
      await AsyncStorage.setItem('zenpay_mock_active_session', JSON.stringify(user));
      if (global.mockAuthListener) {
        global.mockAuthListener(user);
      }
      return user;
    }
    throw { code: 'auth/user-not-found', message: 'No account found with this email or incorrect password.' };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key-not-valid')) {
      console.warn("Firebase API key invalid during login. Trying mock fallback.");
      auth._isMock = true;
      const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
      const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
      const localUser = mockUsers[cleanEmail];
      if (localUser && localUser.password === password) {
        const user = {
          uid: localUser.uid,
          email: localUser.email,
          displayName: localUser.name
        };
        await AsyncStorage.setItem('zenpay_mock_active_session', JSON.stringify(user));
        if (global.mockAuthListener) {
          global.mockAuthListener(user);
        }
        return user;
      }
      throw { code: 'auth/user-not-found', message: 'No account found with this email or incorrect password.' };
    }
    console.error("Login Error: ", error);
    throw error;
  }
};

/**
 * Register a user and initialize their user profile in Firestore
 * @param {string} name 
 * @param {string} email 
 * @param {string} phone 
 * @param {string} password 
 * @returns {Promise<User>}
 */
export const registerUser = async (name, email, phone, password) => {
  try {
    let user;
    const cleanEmail = email.toLowerCase().trim();
    const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;

    if (isMockAuth) {
      console.warn("Using mock client-side auth fallback.");
      const uid = 'mock-uid-' + Math.random().toString(36).substr(2, 9);
      user = {
        uid,
        email: cleanEmail,
        displayName: name,
      };
      
      const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
      const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
      mockUsers[cleanEmail] = { uid, email: cleanEmail, password, name, phone };
      await AsyncStorage.setItem('zenpay_mock_auth_users', JSON.stringify(mockUsers));
      await AsyncStorage.setItem('zenpay_mock_active_session', JSON.stringify(user));
      
      if (global.mockAuthListener) {
        global.mockAuthListener(user);
      }
    } else {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        await updateProfile(user, { displayName: name });
      } catch (err) {
        if (err.code === 'auth/api-key-not-valid' || err.message.includes('api-key-not-valid')) {
          console.warn("Firebase API key invalid. Switching to mock client-side auth fallback.");
          auth._isMock = true;
          
          const uid = 'mock-uid-' + Math.random().toString(36).substr(2, 9);
          user = { uid, email: cleanEmail, displayName: name };
          
          const mockUsersStr = await AsyncStorage.getItem('zenpay_mock_auth_users');
          const mockUsers = mockUsersStr ? JSON.parse(mockUsersStr) : {};
          mockUsers[cleanEmail] = { uid, email: cleanEmail, password, name, phone };
          await AsyncStorage.setItem('zenpay_mock_auth_users', JSON.stringify(mockUsers));
          await AsyncStorage.setItem('zenpay_mock_active_session', JSON.stringify(user));
          
          if (global.mockAuthListener) {
            global.mockAuthListener(user);
          }
        } else {
          throw err;
        }
      }
    }

    // 2. Initialize the user's Firestore document
    const userDocRef = doc(db, 'users', user.uid);
    const userData = {
      uid: user.uid,
      name,
      email: cleanEmail,
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
      if (!isMockAuth && !auth._isMock) {
        await setDoc(userDocRef, userData);
      } else {
        throw new Error("Mock auth mode, skip Firestore setDoc");
      }
      // Cache locally
      await AsyncStorage.setItem(`zenpay_profile_${user.uid}`, JSON.stringify({
        ...userData,
        createdAt: new Date().toISOString()
      }));
    } catch (fsError) {
      console.warn("Firestore user document write skipped/failed, storing locally: ", fsError.message);
      const localUserData = {
        ...userData,
        createdAt: new Date().toISOString()
      };
      await AsyncStorage.setItem(`zenpay_profile_${user.uid}`, JSON.stringify(localUserData));
    }

    return user;
  } catch (error) {
    console.error("Registration Error: ", error);
    throw error;
  }
};

/**
 * Get the current user profile from Firestore
 * @param {string} uid 
 * @returns {Promise<Object>}
 */
export const getUserProfile = async (uid) => {
  try {
    const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
    if (isMockAuth) {
      throw new Error("Mock auth mode: skip Firestore read");
    }

    const userDocRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userDocRef);
    if (userSnapshot.exists()) {
      const data = userSnapshot.data();
      try {
        await AsyncStorage.setItem(`zenpay_profile_${uid}`, JSON.stringify(data));
      } catch (e) {
        console.warn("Failed to cache profile in AsyncStorage: ", e);
      }
      return data;
    } else {
      const localProfile = await AsyncStorage.getItem(`zenpay_profile_${uid}`);
      if (localProfile) {
        return JSON.parse(localProfile);
      }
      throw new Error("User profile not found in database.");
    }
  } catch (error) {
    console.warn("Fetch Firestore Profile failed. Checking AsyncStorage fallback: ", error.message);
    const localProfile = await AsyncStorage.getItem(`zenpay_profile_${uid}`);
    if (localProfile) {
      return JSON.parse(localProfile);
    }
    throw error;
  }
};

/**
 * Log out the current user
 */
export const logoutUser = async () => {
  const isMockAuth = auth.config?.apiKey?.includes('Placeholder') || !auth.config?.apiKey || auth._isMock;
  if (isMockAuth) {
    await AsyncStorage.removeItem('zenpay_mock_active_session');
    if (global.mockAuthListener) {
      global.mockAuthListener(null);
    }
    return;
  }

  try {
    await firebaseSignOut(auth);
  } catch (error) {
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key-not-valid')) {
      auth._isMock = true;
      await AsyncStorage.removeItem('zenpay_mock_active_session');
      if (global.mockAuthListener) {
        global.mockAuthListener(null);
      }
      return;
    }
    console.error("Logout Error: ", error);
    throw error;
  }
};


