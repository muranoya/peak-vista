import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src'),
  base: process.env.NODE_ENV === 'production' ? '/peak-vista/' : '/',
  build: {
    target: 'es2020',
    outDir: path.resolve(__dirname, 'dist'),
    assetsDir: 'assets',
    sourcemap: true,
    emptyOutDir: true,
  },
  server: {
    host: "localhost",
    port: 3000,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
