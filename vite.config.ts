import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base نسبي عشان الموقع يشتغل من أي مسار (GitHub Pages أو غيره)
export default defineConfig({ plugins: [react()], base: './', build: { outDir: 'dist', chunkSizeWarningLimit: 1500 } });
