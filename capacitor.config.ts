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
    adjustMarginsForEdgeToEdge: 'never',
    backgroundColor: '#ffffff',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#FFFFFF',
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    NavigationBar: {
      color: '#ffffff',
      darkButtons: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
