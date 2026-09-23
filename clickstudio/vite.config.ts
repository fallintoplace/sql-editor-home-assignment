import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const webPort = Number(process.env.CLICKSTUDIO_WEB_PORT ?? 5173);
const apiPort = Number(process.env.CLICKSTUDIO_API_PORT ?? 8080);
export default defineConfig({
    root: fileURLToPath(new URL('./web', import.meta.url)),
    plugins: [react(), tailwindcss()],
    server: {
        port: webPort,
        strictPort: true,
        // Match the API namespace, not the frontend /api.ts module.
        proxy: { '^/api(?:/|$)': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false } },
    },
    build: { outDir: '../dist/web', emptyOutDir: true, target: 'es2022' },
});
