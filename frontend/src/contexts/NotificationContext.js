import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// VAPID public key (should match backend)
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Register service worker and subscribe when user logs in
  useEffect(() => {
    if (!user || !token || !isSupported) return;
    
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        console.log('Service Worker registered:', registration);
        
        // Check existing subscription
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) {
          setSubscription(existingSub);
          await sendSubscriptionToServer(existingSub);
        }
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    };
    
    registerSW();
  }, [user, token, isSupported]);

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
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
  };

  // Send subscription to backend
  const sendSubscriptionToServer = async (sub) => {
    if (!token) return;
    
    try {
      await axios.post(`${API}/notifications/subscribe`, {
        subscription: sub.toJSON()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Push subscription sent to server');
    } catch (error) {
      console.error('Failed to send subscription:', error);
    }
  };

  // Request permission and subscribe
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.log('Push notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        setSubscription(sub);
        await sendSubscriptionToServer(sub);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  }, [isSupported, token]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (subscription) {
      try {
        await subscription.unsubscribe();
        setSubscription(null);
        
        // Notify backend
        await axios.delete(`${API}/notifications/unsubscribe`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error('Failed to unsubscribe:', error);
      }
    }
  }, [subscription, token]);

  // Show local notification (for in-app notifications)
  const showLocalNotification = useCallback((title, options = {}) => {
    if (permission !== 'granted') return;
    
    const notification = new Notification(title, {
      icon: '/bruno-icon.png',
      badge: '/bruno-icon.png',
      ...options
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) options.onClick();
    };
    
    return notification;
  }, [permission]);

  const value = {
    isSupported,
    permission,
    subscription,
    requestPermission,
    unsubscribe,
    showLocalNotification,
    isSubscribed: !!subscription
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
