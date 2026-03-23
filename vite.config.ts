import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'));
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // Chrome 79 (Android 9) — ES2018 max (optional chaining ?. et ?? arrivent en Chrome 80)
    target: ['es2018', 'chrome79', 'safari12'],
    cssTarget: ['chrome79', 'safari12'],
  },
});
