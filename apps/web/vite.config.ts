import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({ plugins: [react(),tailwindcss()], build:{rollupOptions:{input:{guestOrder:fileURLToPath(new URL('./order/index.html',import.meta.url)),main:fileURLToPath(new URL('./index.html',import.meta.url)),line:fileURLToPath(new URL('./line/index.html',import.meta.url)),linePublished:fileURLToPath(new URL('./line/published/index.html',import.meta.url))}}}, envDir: fileURLToPath(new URL('../../', import.meta.url)), server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8080' } } });
