import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doulacare.app',
  appName: 'doula-care',
  webDir: 'dist',
  server: {
    url: 'https://doulacare.app.br?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
