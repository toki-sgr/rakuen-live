import { defineConfig } from 'vite';

// The content API runs separately (`npm run api`); both the dev server and
// `vite preview` forward to it so a production build can be checked locally.
const apiProxy = {
    '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
    },
};

export default defineConfig({
    root: '.',
    server: { port: 3000, proxy: apiProxy },
    preview: { port: 4173, proxy: apiProxy },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: { input: './index.html' },
    },
});
