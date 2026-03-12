import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doulacare.app',
  appName: 'Doula Care',
  webDir: 'dist',
  server: {
    url: 'https://doulacare.app.br',
    cleartext: false
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
    backgroundColor: '#c34a1c',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#FFFFFF',
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#c34a1c',
      overlaysWebView: false,
    },
    NavigationBar: {
      color: '#c34a1c',
      darkButtons: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
