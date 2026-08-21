import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

const workspacePackages = {
  '@reizoko/shared': path.join(root, 'packages/shared/src/index.ts'),
  '@reizoko/core': path.join(root, 'packages/core/src/index.ts'),
  '@reizoko/database': path.join(root, 'packages/database/src/index.ts'),
  '@reizoko/platform-sdk': path.join(root, 'packages/platform-sdk/src/index.ts'),
  '@reizoko/ui': path.join(root, 'packages/ui/src/index.ts'),
  '@reizoko/ui/styles.css': path.join(root, 'packages/ui/src/styles/global.css'),
  '@reizoko/editor': path.join(root, 'packages/editor/src/index.ts'),
  '@reizoko/platform-instagram': path.join(root, 'platforms/instagram/src/index.ts'),
  '@reizoko/platform-telegram': path.join(root, 'platforms/telegram/src/index.ts'),
  '@reizoko/platform-vk': path.join(root, 'platforms/vk/src/index.ts'),
};

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    open: false,
    watch: {
      ignored: ['**/src-tauri/target/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...workspacePackages,
    },
  },
});
