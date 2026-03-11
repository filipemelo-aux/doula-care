import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doulacare.app',
  appName: 'Doula Care',
  webDir: 'dist',
  server: {
    url: 'https://doulacare.app.br',
    cleartext: false
  }
};

export default config;
