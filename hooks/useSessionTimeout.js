import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, PanResponder } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

const TIMEOUT_DURATION = 5 * 60 * 1000; // 5 minutes
const WARNING_DURATION = 4 * 60 * 1000; // 4 minutes of inactivity

export default function useSessionTimeout() {
  const timer = useRef(null);
  const warningTimer = useRef(null);
  const { logout } = useAuthStore();
  const [warningVisible, setWarningVisible] = useState(false);
  const sessionStartTime = useRef(Date.now()).current;

  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);

    setWarningVisible(false);

    AsyncStorage.setItem('zenpay_last_active', Date.now().toString());

    // Warning after 4 minutes
    warningTimer.current = setTimeout(() => {
      setWarningVisible(true);
    }, WARNING_DURATION);

    // Logout after 5 minutes
    timer.current = setTimeout(async () => {
      setWarningVisible(false);
      try {
        await logout();
        await AsyncStorage.setItem('zenpay_timeout_logout', 'true');
        router.replace('/(auth)/login');
      } catch (err) {
        console.error("Session timeout logout failed:", err);
      }
    }, TIMEOUT_DURATION);
  }, [logout]);

  useEffect(() => {
    resetTimer();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        AsyncStorage.getItem('zenpay_last_active')
          .then((last) => {
            if (last) {
              // Safeguard: if the session is newer than the timeout duration, ignore old storage timestamps
              if (Date.now() - sessionStartTime < TIMEOUT_DURATION) {
                resetTimer();
                return;
              }

              const elapsed = Date.now() - parseInt(last);
              if (elapsed > TIMEOUT_DURATION) {
                logout().then(() => {
                  AsyncStorage.setItem('zenpay_timeout_logout', 'true');
                  router.replace('/(auth)/login');
                });
              } else {
                resetTimer();
              }
            }
          });
      } else {
        // App went to background
        AsyncStorage.setItem('zenpay_last_active', Date.now().toString());
        if (timer.current) clearTimeout(timer.current);
        if (warningTimer.current) clearTimeout(warningTimer.current);
      }
    });

    return () => {
      subscription.remove();
      if (timer.current) clearTimeout(timer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
  }, [resetTimer, logout]);

  // Capture user interaction to reset inactivity timer
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      },
    })
  ).current;

  return { resetTimer, warningVisible, panHandlers: panResponder.panHandlers };
}
