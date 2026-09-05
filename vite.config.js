import { defineConfig } from 'vite';
import { torrentBridgePlugin } from './torrentBridge.js';

export default defineConfig({
  plugins: [torrentBridgePlugin()],
  server: {
    port: 3000,
    host: true,
    open: false,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
});
