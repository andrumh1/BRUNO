/**
 * Native platform detection.
 *
 * Import from anywhere in the codebase to gate native-only code paths.
 * Falls back to browser-safe behavior in the web build.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
