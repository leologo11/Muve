import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-driver',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index-driver.html'),
    },
  },
  // VITE_API_URL must be set as env var when building for production
  // e.g.: VITE_API_URL=https://muveapp.cl npm run build:driver
});
