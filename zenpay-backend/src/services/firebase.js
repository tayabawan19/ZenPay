const admin = require('firebase-admin');
require('dotenv').config();

// Ensure the private key handles newline characters correctly
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

let isInitialized = false;

try {
  // Only try initializing if the credentials are not placeholders
  if (
    process.env.FIREBASE_PROJECT_ID && 
    !process.env.FIREBASE_PROJECT_ID.includes('your_') &&
    process.env.FIREBASE_CLIENT_EMAIL && 
    !process.env.FIREBASE_CLIENT_EMAIL.includes('your_') &&
    privateKey
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
    isInitialized = true;
  } else {
    console.warn('Firebase Admin credentials not configured. Falling back to local in-memory database.');
  }
} catch (error) {
  console.warn('Firebase Admin SDK could not initialize:', error.message);
}

// Local in-memory mock Firestore database for testing when Firebase credentials are placeholders
class MockDoc {
  constructor(id, dataStore) {
    this.id = id;
    this.dataStore = dataStore;
  }

  async get() {
    const data = this.dataStore.get(this.id);
    return {
      exists: !!data,
      data: () => data
    };
  }

  async set(data) {
    this.dataStore.set(this.id, { ...data });
  }

  async update(data) {
    const current = this.dataStore.get(this.id) || {};
    this.dataStore.set(this.id, { ...current, ...data });
  }
}

class MockCollection {
  constructor(name, database) {
    this.name = name;
    if (!database[name]) {
      database[name] = new Map();
    }
    this.dataStore = database[name];
  }

  doc(id) {
    return new MockDoc(id, this.dataStore);
  }
}

class MockFirestore {
  constructor() {
    this.database = {};
  }

  collection(name) {
    return new MockCollection(name, this.database);
  }
}

class SafeFirestore {
  constructor(realDb) {
    this.realDb = realDb;
    this.mockDb = new MockFirestore();
    this.useMock = false;
  }

  collection(name) {
    const self = this;
    return {
      doc(id) {
        return {
          async get() {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(id).get();
            }
            try {
              return await self.realDb.collection(name).doc(id).get();
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(id).get();
              }
              throw err;
            }
          },
          async set(data) {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(id).set(data);
            }
            try {
              return await self.realDb.collection(name).doc(id).set(data);
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(id).set(data);
              }
              throw err;
            }
          },
          async update(data) {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(id).update(data);
            }
            try {
              return await self.realDb.collection(name).doc(id).update(data);
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(id).update(data);
              }
              throw err;
            }
          }
        };
      }
    };
  }
}

const db = isInitialized ? new SafeFirestore(admin.firestore()) : new MockFirestore();
const auth = isInitialized ? admin.auth() : null;

module.exports = { admin, db, auth };
