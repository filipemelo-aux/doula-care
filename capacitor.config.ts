import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doulacare.app',
  appName: 'Doula Care',
  webDir: 'dist',
  server: {
    url: 'https://2c48c3f3-dcdf-4fc1-a578-416d5bffa96a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#c34a1c',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
