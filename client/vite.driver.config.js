import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Capacitor requires the entry to be named index.html.
// closeBundle runs after files are written to disk so we can rename it there.
function renameToIndexHtml() {
  return {
    name: 'rename-to-index-html',
    closeBundle() {
      const src = path.resolve(__dirname, 'dist-driver/index-driver.html');
      const dst = path.resolve(__dirname, 'dist-driver/index.html');
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), renameToIndexHtml()],
  build: {
    outDir: 'dist-driver',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index-driver.html'),
    },
  },
});
