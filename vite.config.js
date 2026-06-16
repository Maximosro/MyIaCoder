import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import electron from 'vite-plugin-electron';
import { resolve } from 'node:path';
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        electron([
            {
                entry: 'electron/main.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['node-pty'],
                        },
                    },
                },
            },
            {
                entry: 'electron/preload.ts',
                onstart(options) {
                    // Notify renderer to reload when preload is rebuilt
                    options.reload();
                },
            },
        ]),
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    optimizeDeps: {
        include: ['monaco-editor'],
    },
    build: {
        rollupOptions: {
            output: {},
        },
    },
});
