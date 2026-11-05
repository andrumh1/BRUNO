import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { isNative } from '@/native/capacitor';
import { enableNativePush, nativePushAvailable, nativePushPermission } from '@/native/useNativePush';

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(token) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);

  // Check if push is supported
  useEffect(() => {
    if (isNative()) {
      // App nativa: FCM vía @capacitor/push-notifications; sin Firebase configurado se muestra como no disponible, sin crash.
      nativePushAvailable().then(setIsSupported);
      nativePushPermission().then((p) => { setPermission(p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default'); setIsSubscribed(p === 'granted'); });
      return;
    }
    const supported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check current subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isSupported) return;
      
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };
    
    checkSubscription();
  }, [isSupported]);

  // Request permission and subscribe
  const subscribe = useCallback(async () => {
    if (!isSupported || !token) return false;
    
    setLoading(true);
    if (isNative()) {
      const ok = await enableNativePush();
      setPermission(ok ? 'granted' : 'denied');
      setIsSubscribed(ok);
      setLoading(false);
      return ok;
    }
    try {
      // Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result !== 'granted') {
        setLoading(false);
        return false;
      }
      
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      
      // Send subscription to backend
      const subscriptionJSON = subscription.toJSON();
      await axios.post(`${API}/push/subscribe`, {
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setIsSubscribed(true);
      setLoading(false);
      return true;
      
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setLoading(false);
      return false;
    }
  }, [isSupported, token]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !token) return false;
    if (isNative()) { setIsSubscribed(false); return true; } // la preferencia push_enabled=false la guarda la página
    
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();
        
        // Remove from backend
        await axios.delete(`${API}/push/unsubscribe`, {
          params: { endpoint: subscription.endpoint },
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      
      setIsSubscribed(false);
      setLoading(false);
      return true;
      
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      setLoading(false);
      return false;
    }
  }, [isSupported, token]);

  // Send test notification
  const sendTestNotification = useCallback(async () => {
    if (!token) return false;
    
    try {
      await axios.post(`${API}/push/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, [token]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification
  };
}

export default usePushNotifications;
