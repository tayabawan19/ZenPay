
                                                       
  💳  Z E N P A Y  —  Premium Fintech Mobile App       


ZenPay is a production-grade, full-stack fintech mobile 
application built with React Native & Expo, designed to 
simulate a modern digital wallet and payment platform. 
Inspired by industry-leading apps like Revolut, JazzCash, 
and Cashly — built entirely on a zero-cost free-tier 
infrastructure stack.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏗️  BUILT WITH

  ▸ React Native + Expo SDK      → Cross-platform mobile
  ▸ Expo Router                  → File-based navigation
  ▸ Zustand                      → Global state management
  ▸ Node.js + Express            → REST API backend
  ▸ Firebase Auth                → User authentication
  ▸ Cloud Firestore              → Real-time database
  ▸ Brevo Email API              → OTP verification
  ▸ Stripe (Test Mode)           → Payment processing
  ▸ Victory Native               → Interactive charts
  ▸ React Native Animated        → 3D animations
  ▸ expo-local-authentication    → Biometric login
  ▸ expo-notifications           → Push notifications
  ▸ Render (Free Tier)           → Backend deployment
  ▸ EAS Build                    → APK generation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨  CORE FEATURES

  💸  P2P Money Transfers
      ├─ Real-time transfers between registered users
      ├─ Atomic Firestore batch writes (ALL or NOTHING)
      ├─ Sender balance deducted + receiver credited
      │  in a single atomic operation
      └─ Prevents partial transaction states entirely

  ⚡  Real-Time Balance Sync
      ├─ Firestore onSnapshot listeners active post-login
      ├─ Balance updates instantly on both sender &
      │  receiver screens without any manual refresh
      └─ Zero polling — purely event-driven architecture

  🔐  Authentication System
      ├─ Firebase Auth (email + password)
      ├─ Custom Brevo email OTP on registration
      ├─ 6-digit OTP generated server-side (Node.js)
      ├─ OTP stored in Firestore with 5-min expiry
      ├─ Verified before Firebase account creation
      └─ Forgot password via Firebase reset email

  💰  Stripe Top-Up (Test Mode)
      ├─ Native Stripe payment sheet via
      │  @stripe/stripe-react-native SDK
      ├─ Backend creates PaymentIntent server-side
      ├─ Verifies payment status before crediting
      ├─ Atomically increments balance in Firestore
      └─ Test card: 4242 4242 4242 4242

  💳  Virtual Card Management
      ├─ 3D perspective card flip animation
      │  (React Native Animated API)
      ├─ Front: masked card number, name, expiry
      ├─ Back: CVV reveal + magnetic strip
      ├─ Freeze / Unfreeze toggle (Firestore sync)
      ├─ Spending limit slider
      └─ Online payments toggle

  📊  Spending Analytics
      ├─ Victory Native line charts
      │  (Weekly / Monthly / Yearly views)
      ├─ Donut chart by category:
      │  Food · Transport · Shopping · Bills · Other
      ├─ All data sourced from real Firestore documents
      └─ Updates live as new transactions are added

  🔔  Push Notifications
      ├─ expo-notifications fires instantly
      │  when transfer is received
      └─ Shows sender name + amount received

  👆  Biometric Login
      ├─ expo-local-authentication
      ├─ Supports Face ID + Fingerprint
      └─ Checks hardware support before enabling

  📜  Transaction History
      ├─ Real Firestore transaction documents
      ├─ Filter: All / Sent / Received / Failed
      ├─ Grouped by date (Today / Yesterday / Earlier)
      └─ Pull to refresh + pagination

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  DATABASE STRUCTURE

  Firestore Collections:

  📁 /users/{uid}
     ├─ name, email, phone
     ├─ balance (real-time)
     ├─ kycStatus
     └─ virtualCard { number, cvv, expiry,
                      limit, spent, isFrozen }

  📁 /transactions/{txnId}
     ├─ senderId, receiverId
     ├─ senderName, receiverName
     ├─ amount, type (debit | credit)
     ├─ category (transfer | topup)
     ├─ status (success | pending | failed)
     ├─ note
     └─ timestamp

  📁 /contacts/{uid}/contacts/{contactUid}
     ├─ name, phone
     └─ lastTransfer (auto-saved on transfer)

  📁 /otps/{email}
     ├─ otp (6-digit)
     ├─ expiresAt (5 min window)
     └─ verified (boolean)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔒  SECURITY

  ▸ Firestore Security Rules → users read/write
    only their own documents
  ▸ OTP expires after 5 minutes server-side
  ▸ PaymentIntent verified server-side before
    any balance update
  ▸ Atomic batch writes prevent race conditions
  ▸ Balance checked server-side before transfer
    (insufficient balance rejected at API level)
  ▸ No sensitive keys stored in React Native bundle

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🖥️  BACKEND API  (Node.js + Express → Render)

  AUTH ROUTES (/api/auth)
  ├─ POST  /send-otp          → Generate & email OTP
  └─ POST  /verify-otp        → Verify OTP + expiry check

  PAYMENT ROUTES (/api/payment)
  ├─ POST  /create-payment-intent → Stripe PaymentIntent
  └─ POST  /confirm-topup     → Verify + credit balance

  TRANSFER ROUTES (/api/transfer)
  ├─ GET   /search-users      → Search by email/phone
  └─ POST  /send              → Atomic P2P transfer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱  SCREENS

  ① 🔑  Login Screen
  ② 📝  Register + OTP Verification
  ③ 🏠  Home  (balance card + quick send + recent txns)
  ④ 💸  Transfer  (search users + numpad + confirm)
  ⑤ 📊  Analytics  (charts + category breakdown)
  ⑥ 💳  Virtual Card  (3D flip + card controls)
  ⑦ 📜  Transaction History  (filter + grouped by date)
  ⑧ 👤  Profile  (settings + biometrics + logout)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰  TOTAL INFRASTRUCTURE COST

  ┌─────────────────────────────┬──────────┐
  │ Service                     │ Cost     │
  ├─────────────────────────────┼──────────┤
  │ Firebase Spark Plan         │ FREE     │
  │ Render Web Service          │ FREE     │
  │ Brevo Email API             │ FREE     │
  │ Stripe Test Mode            │ FREE     │
  │ Expo + EAS Build            │ FREE     │
  │ GitHub                      │ FREE     │
  ├─────────────────────────────┼──────────┘
  │ 💚 TOTAL MONTHLY COST       │ $0.00    │
  └─────────────────────────────┴──────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👨‍💻  DEVELOPED BY

  Muhammad Tayyab
  BS Software Engineering — COMSATS University Islamabad
  4th Semester

  🌐  tayab.me
  🐙  github.com/tayabawan19
  📧  tayabawan.in@gmail.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
