import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // SECURE: Only backend URL exposed to frontend
        // NO API KEYS HERE!
        'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL || 'https://for-ms-backend-22097057568.us-west1.run.app/'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
