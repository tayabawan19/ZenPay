import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getReactNativePersistence, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase Web Configuration
// These values can be replaced with your actual Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyFakeKeyPlaceholder123456789",
  authDomain: "zenpay-app.firebaseapp.com",
  projectId: "zenpay-app",
  storageBucket: "zenpay-app.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789",
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Set up persistent authentication state for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

// Resilient onAuthStateChanged wrapper
export const onAuthStateChanged = (authObj, callback) => {
  global.mockAuthListener = callback;

  const isMockAuth = authObj.config?.apiKey?.includes('Placeholder') || !authObj.config?.apiKey || authObj._isMock;

  if (isMockAuth) {
    AsyncStorage.getItem('zenpay_mock_active_session').then((sessionStr) => {
      if (sessionStr) {
        callback(JSON.parse(sessionStr));
      } else {
        callback(null);
      }
    }).catch(() => {
      callback(null);
    });
    return () => {
      global.mockAuthListener = null;
    };
  }

  let unsub;
  try {
    unsub = firebaseOnAuthStateChanged(authObj, (user) => {
      if (authObj._isMock) return;
      callback(user);
    }, (error) => {
      console.warn("Firebase onAuthStateChanged error, attempting fallback: ", error.message);
      if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key-not-valid')) {
        authObj._isMock = true;
        AsyncStorage.getItem('zenpay_mock_active_session').then((sessionStr) => {
          if (sessionStr) callback(JSON.parse(sessionStr));
          else callback(null);
        });
      }
    });
  } catch (err) {
    console.warn("Failed to subscribe standard auth listener, using mock: ", err.message);
    authObj._isMock = true;
    AsyncStorage.getItem('zenpay_mock_active_session').then((sessionStr) => {
      if (sessionStr) callback(JSON.parse(sessionStr));
      else callback(null);
    });
    return () => {
      global.mockAuthListener = null;
    };
  }

  return () => {
    if (unsub) unsub();
    global.mockAuthListener = null;
  };
};

// Resilient signOut wrapper
export const signOut = async (authObj) => {
  const isMockAuth = authObj.config?.apiKey?.includes('Placeholder') || !authObj.config?.apiKey || authObj._isMock;

  if (isMockAuth) {
    await AsyncStorage.removeItem('zenpay_mock_active_session');
    if (global.mockAuthListener) {
      global.mockAuthListener(null);
    }
    return;
  }

  try {
    await firebaseSignOut(authObj);
  } catch (error) {
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('api-key-not-valid')) {
      authObj._isMock = true;
      await AsyncStorage.removeItem('zenpay_mock_active_session');
      if (global.mockAuthListener) {
        global.mockAuthListener(null);
      }
      return;
    }
    console.error("SignOut error: ", error);
    throw error;
  }
};

export { app, auth, db };
