import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    root: fileURLToPath(new URL('./web', import.meta.url)),
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        strictPort: true,
        // Match the API namespace, not the frontend /api.ts module.
        proxy: { '^/api(?:/|$)': { target: 'http://127.0.0.1:8080', changeOrigin: false } },
    },
    build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2022' },
});
