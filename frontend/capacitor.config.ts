/// <reference types="@capacitor/cli" />
import type { CapacitorConfig } from '@capacitor/cli';

/**
 * BRUNO — Capacitor config
 *
 * • App ID (bundle identifier): com.brunocard.app
 * • App name shown on the launcher: BRUNO
 * • Web dir: `build/` (created by `yarn build`)
 * • Uses `server.url` for hot-reload / preview mode.
 *   For production stores, comment out the `server` block below so the
 *   bundled webDir assets are used and the app works fully offline.
 */
const config: CapacitorConfig = {
  appId: 'com.brunocard.app',
  appName: 'BRUNO',
  webDir: 'build',
  bundledWebRuntime: false,
  // ── UNCOMMENT for dev / preview against the live backend ──────────────
  // server: {
  //   url: 'https://premium-launch-13.preview.emergentagent.com',
  //   cleartext: false,
  // },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#FF6B35',
      androidSplashResourceName: 'splash',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FF6B35',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
