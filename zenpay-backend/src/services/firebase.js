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
    const resolvedData = {};
    for (const key in data) {
      const val = data[key];
      if (val && typeof val === 'object' && (val._methodName === 'FieldValue.increment' || val.operand !== undefined)) {
        const operand = val._val !== undefined ? val._val : (val.operand !== undefined ? val.operand : 0);
        resolvedData[key] = operand;
      } else if (val && typeof val === 'object' && val._methodName === 'FieldValue.serverTimestamp') {
        resolvedData[key] = new Date();
      } else {
        resolvedData[key] = val;
      }
    }
    this.dataStore.set(this.id, resolvedData);
  }

  async update(data) {
    const current = this.dataStore.get(this.id) || {};
    const resolvedData = {};
    for (const key in data) {
      const val = data[key];
      if (val && typeof val === 'object' && (val._methodName === 'FieldValue.increment' || val.operand !== undefined)) {
        const currentVal = current[key] || 0;
        const operand = val._val !== undefined ? val._val : (val.operand !== undefined ? val.operand : 0);
        resolvedData[key] = currentVal + operand;
      } else if (val && typeof val === 'object' && val._methodName === 'FieldValue.serverTimestamp') {
        resolvedData[key] = new Date();
      } else {
        resolvedData[key] = val;
      }
    }
    this.dataStore.set(this.id, { ...current, ...resolvedData });
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
    const docId = id !== undefined && id !== null
      ? id
      : 'mock_id_' + Math.random().toString(36).substring(2, 12);
    return new MockDoc(docId, this.dataStore);
  }
}

class MockFirestore {
  constructor() {
    this.database = {};
  }

  collection(name) {
    return new MockCollection(name, this.database);
  }

  batch() {
    const operations = [];
    return {
      update(docRef, data) {
        operations.push({ type: 'update', ref: docRef, data });
      },
      set(docRef, data) {
        operations.push({ type: 'set', ref: docRef, data });
      },
      async commit() {
        for (const op of operations) {
          if (op.type === 'update') {
            await op.ref.update(op.data);
          } else if (op.type === 'set') {
            await op.ref.set(op.data);
          }
        }
      }
    };
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
        const realDoc = id !== undefined && id !== null
          ? self.realDb.collection(name).doc(id)
          : self.realDb.collection(name).doc();
        const docId = id !== undefined && id !== null ? id : realDoc.id;
        return {
          _realDoc: realDoc,
          id: docId,
          async get() {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(docId).get();
            }
            try {
              return await realDoc.get();
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(docId).get();
              }
              throw err;
            }
          },
          async set(data) {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(docId).set(data);
            }
            try {
              return await realDoc.set(data);
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(docId).set(data);
              }
              throw err;
            }
          },
          async update(data) {
            if (self.useMock) {
              return self.mockDb.collection(name).doc(docId).update(data);
            }
            try {
              return await realDoc.update(data);
            } catch (err) {
              if (err.message && (
                err.message.includes('PERMISSION_DENIED') || 
                err.message.includes('firestore.googleapis.com') || 
                err.message.includes('SERVICE_DISABLED') ||
                err.code === 7
              )) {
                console.warn("Firestore API seems disabled or denied in the cloud project. Falling back to local in-memory database for this session.");
                self.useMock = true;
                return self.mockDb.collection(name).doc(docId).update(data);
              }
              throw err;
            }
          }
        };
      }
    };
  }

  batch() {
    if (this.useMock) {
      return this.mockDb.batch();
    } else {
      const realBatch = this.realDb.batch();
      return {
        update(docRef, data) {
          realBatch.update(docRef._realDoc, data);
        },
        set(docRef, data) {
          realBatch.set(docRef._realDoc, data);
        },
        async commit() {
          await realBatch.commit();
        }
      };
    }
  }
}

const db = isInitialized ? new SafeFirestore(admin.firestore()) : new MockFirestore();
const auth = isInitialized ? admin.auth() : null;

module.exports = { admin, db, auth };
