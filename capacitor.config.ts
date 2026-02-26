import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.doulacare',
  appName: 'doula-care',
  webDir: 'dist',
  server: {
    url: 'https://2c48c3f3-dcdf-4fc1-a578-416d5bffa96a.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
