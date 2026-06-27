const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS properly for all origins (needed for React Native)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse incoming JSON body payloads
app.use(express.json());

// Mount authentication routers
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    app: 'ZenPay Backend',
    version: '1.0.0'
  });
});

// Catch-all route handler for unknown endpoints
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`ZenPay backend server active on port ${PORT}`);
});
