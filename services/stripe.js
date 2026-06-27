import { initStripe } from '@stripe/stripe-react-native';

// Stripe test publishable key (Replace with your actual Stripe publishable key to connect to live sandbox)
const STRIPE_KEY = 'pk_test_XXXXXXXXXXXXXXXX'; 

export const initializeStripe = () => {
  try {
    initStripe({
      publishableKey: STRIPE_KEY,
      merchantIdentifier: 'com.zenpay.app',
    });
  } catch (error) {
    console.warn("Stripe could not be initialized natively (e.g. running in standard Expo Go):", error);
  }
};

/**
 * Simulate Stripe payment sheet presenting.
 * Since Firebase Cloud Functions are disabled (Spark plan only), we simulate the network
 * round-trip of initializing the payment sheet and processing the payment with the test card.
 * @param {number} amount 
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const presentMockPaymentSheet = async (amount) => {
  return new Promise((resolve) => {
    // Simulate UI processing latency
    setTimeout(() => {
      if (amount <= 0) {
        resolve({ success: false, error: "Invalid payment amount" });
      } else {
        resolve({ success: true });
      }
    }, 1500);
  });
};
