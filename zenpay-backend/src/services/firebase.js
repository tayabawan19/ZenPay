const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
let client = null;
let mongoDb = null;
let connectionPromise = null;
let useMockDb = false;

if (uri) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 }); // 3s connection timeout for fast fallback
} else {
  console.warn("MONGODB_URI not configured. Using local in-memory fallback.");
  useMockDb = true;
}

async function getDb() {
  if (useMockDb) return null;
  if (mongoDb) return mongoDb;
  if (!client) throw new Error("MongoDB client is not initialized.");
  
  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        console.log('Connecting to MongoDB Atlas (SRV)...');
        await client.connect();
        console.log('MongoDB Atlas connected successfully!');
        mongoDb = client.db('zenpay');
        return mongoDb;
      } catch (err) {
        if (err.message && (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED'))) {
          console.warn('MongoDB SRV resolution failed. Attempting direct shard connection fallback...');
          try {
            const directUrl = 'mongodb://tayabawan19:pubgmobile@ac-e7uv24k-shard-00-00.nxw2pnd.mongodb.net:27017,ac-e7uv24k-shard-00-01.nxw2pnd.mongodb.net:27017,ac-e7uv24k-shard-00-02.nxw2pnd.mongodb.net:27017/zenpay?ssl=true&authSource=admin&appName=tayabawan';
            const directClient = new MongoClient(directUrl, { serverSelectionTimeoutMS: 4000 });
            await directClient.connect();
            console.log('MongoDB Atlas direct shard connection successful!');
            mongoDb = directClient.db('zenpay');
            return mongoDb;
          } catch (directErr) {
            console.warn('MongoDB direct connection also failed, enabling mock database fallback:', directErr.message);
            useMockDb = true;
            return null;
          }
        } else {
          console.warn('Failed to connect to MongoDB Atlas, enabling mock database fallback:', err.message);
          useMockDb = true;
          return null;
        }
      }
    })();
  }
  return connectionPromise;
}

// --- Local in-memory Mock Firestore database for fallback ---
class MockDoc {
  constructor(id, dataStore, docPath, database) {
    this.id = id;
    this.dataStore = dataStore;
    this.docPath = docPath;
    this.database = database;
  }

  collection(subName) {
    return new MockCollection(`${this.docPath}/${subName}`, this.database);
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
    this.database = database;
    if (!database[name]) {
      database[name] = new Map();
    }
    this.dataStore = database[name];
  }

  doc(id) {
    const docId = id !== undefined && id !== null
      ? id
      : 'mock_id_' + Math.random().toString(36).substring(2, 12);
    return new MockDoc(docId, this.dataStore, `${this.name}/${docId}`, this.database);
  }

  async get() {
    const docs = [];
    this.dataStore.forEach((value, key) => {
      docs.push({
        id: key,
        exists: true,
        data: () => value
      });
    });
    return {
      forEach(callback) {
        docs.forEach(callback);
      },
      docs
    };
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

const mockDbInstance = new MockFirestore();

// --- MongoDB implementation with transparent fallback ---
class MongoDoc {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  collection(subName) {
    if (useMockDb) {
      return mockDbInstance.collection(`${this.collectionName}/${this.id}/${subName}`);
    }
    return new MongoCollection(`${this.collectionName}/${this.id}/${subName}`);
  }

  async get() {
    if (useMockDb) {
      return mockDbInstance.collection(this.collectionName).doc(this.id).get();
    }
    try {
      const dbInstance = await getDb();
      if (useMockDb) {
        return mockDbInstance.collection(this.collectionName).doc(this.id).get();
      }
      const doc = await dbInstance.collection(this.collectionName).findOne({ _id: this.id });
      return {
        exists: !!doc,
        data: () => {
          if (!doc) return null;
          const { _id, ...rest } = doc;
          return rest;
        }
      };
    } catch (err) {
      if (this._isNetworkError(err)) {
        console.warn("MongoDB connection offline. Falling back to local mock database.");
        useMockDb = true;
        return mockDbInstance.collection(this.collectionName).doc(this.id).get();
      }
      throw err;
    }
  }

  async set(data) {
    if (useMockDb) {
      return mockDbInstance.collection(this.collectionName).doc(this.id).set(data);
    }
    try {
      const dbInstance = await getDb();
      if (useMockDb) {
        return mockDbInstance.collection(this.collectionName).doc(this.id).set(data);
      }
      const resolvedData = this._resolveSpecialFields(data);
      await dbInstance.collection(this.collectionName).updateOne(
        { _id: this.id },
        { $set: resolvedData },
        { upsert: true }
      );
    } catch (err) {
      if (this._isNetworkError(err)) {
        console.warn("MongoDB connection offline. Falling back to local mock database.");
        useMockDb = true;
        return mockDbInstance.collection(this.collectionName).doc(this.id).set(data);
      }
      throw err;
    }
  }

  async update(data) {
    if (useMockDb) {
      return mockDbInstance.collection(this.collectionName).doc(this.id).update(data);
    }
    try {
      const dbInstance = await getDb();
      if (useMockDb) {
        return mockDbInstance.collection(this.collectionName).doc(this.id).update(data);
      }
      
      const updateQuery = { $set: {}, $inc: {} };
      
      for (const key in data) {
        const val = data[key];
        
        const isIncrement = val && typeof val === 'object' && 
          (val._methodName === 'FieldValue.increment' || val.operand !== undefined);
        
        const isTimestamp = val && typeof val === 'object' && 
          val._methodName === 'FieldValue.serverTimestamp';
          
        if (isIncrement) {
          const operand = val._val !== undefined ? val._val : (val.operand !== undefined ? val.operand : 0);
          updateQuery.$inc[key] = operand;
        } else if (isTimestamp) {
          updateQuery.$set[key] = new Date();
        } else {
          updateQuery.$set[key] = val;
        }
      }
      
      const mongoUpdate = {};
      if (Object.keys(updateQuery.$set).length > 0) {
        mongoUpdate.$set = updateQuery.$set;
      }
      if (Object.keys(updateQuery.$inc).length > 0) {
        mongoUpdate.$inc = updateQuery.$inc;
      }
      
      await dbInstance.collection(this.collectionName).updateOne(
        { _id: this.id },
        mongoUpdate,
        { upsert: true }
      );
    } catch (err) {
      if (this._isNetworkError(err)) {
        console.warn("MongoDB connection offline. Falling back to local mock database.");
        useMockDb = true;
        return mockDbInstance.collection(this.collectionName).doc(this.id).update(data);
      }
      throw err;
    }
  }

  _isNetworkError(err) {
    return err && err.message && (
      err.message.includes('ECONNREFUSED') || 
      err.message.includes('ETIMEDOUT') || 
      err.message.includes('ENOTFOUND') ||
      err.message.includes('server selection')
    );
  }

  _resolveSpecialFields(data) {
    const resolved = {};
    for (const key in data) {
      const val = data[key];
      if (val && typeof val === 'object' && (val._methodName === 'FieldValue.increment' || val.operand !== undefined)) {
        const operand = val._val !== undefined ? val._val : (val.operand !== undefined ? val.operand : 0);
        resolved[key] = operand;
      } else if (val && typeof val === 'object' && val._methodName === 'FieldValue.serverTimestamp') {
        resolved[key] = new Date();
      } else {
        resolved[key] = val;
      }
    }
    return resolved;
  }
}

class MongoCollection {
  constructor(name) {
    this.name = name;
  }

  doc(id) {
    const docId = id !== undefined && id !== null ? id : 'doc_' + Math.random().toString(36).substring(2, 12);
    return new MongoDoc(this.name, docId);
  }

  async get() {
    if (useMockDb) {
      return mockDbInstance.collection(this.name).get();
    }
    try {
      const dbInstance = await getDb();
      if (useMockDb) {
        return mockDbInstance.collection(this.name).get();
      }
      const docs = await dbInstance.collection(this.name).find({}).toArray();
      const formattedDocs = docs.map(doc => ({
        id: doc._id,
        exists: true,
        data: () => {
          const { _id, ...rest } = doc;
          return rest;
        }
      }));
      return {
        forEach(callback) {
          formattedDocs.forEach(callback);
        },
        docs: formattedDocs
      };
    } catch (err) {
      if (this._isNetworkError(err)) {
        console.warn("MongoDB connection offline. Falling back to local mock database.");
        useMockDb = true;
        return mockDbInstance.collection(this.name).get();
      }
      throw err;
    }
  }

  _isNetworkError(err) {
    return err && err.message && (
      err.message.includes('ECONNREFUSED') || 
      err.message.includes('ETIMEDOUT') || 
      err.message.includes('ENOTFOUND') ||
      err.message.includes('server selection')
    );
  }
}

class MongoBatch {
  constructor() {
    this.operations = [];
  }

  update(docRef, data) {
    this.operations.push({ type: 'update', ref: docRef, data });
  }

  set(docRef, data) {
    this.operations.push({ type: 'set', ref: docRef, data });
  }

  async commit() {
    for (const op of this.operations) {
      if (op.type === 'update') {
        await op.ref.update(op.data);
      } else if (op.type === 'set') {
        await op.ref.set(op.data);
      }
    }
  }
}

class MongoFirestore {
  collection(name) {
    return new MongoCollection(name);
  }

  batch() {
    return new MongoBatch();
  }
}

const FieldValue = {
  increment: (val) => ({ _methodName: 'FieldValue.increment', _val: val, operand: val }),
  serverTimestamp: () => ({ _methodName: 'FieldValue.serverTimestamp' })
};

const admin = {
  firestore: {
    FieldValue
  }
};

const db = new MongoFirestore();
const auth = null;

module.exports = { admin, db, auth };
