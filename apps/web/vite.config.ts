import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  // @ts-expect-error — tipos do Vite na raiz do monorepo podem divergir
  plugins: [react()],
  resolve: {
    // Usa o TypeScript-fonte no dev: evita tela branca quando `packages/*/dist` ainda não foi gerado
    // e evita problemas de resolução CJS/ESM do pacote publicado só em `dist`.
    alias: {
      '@princefall/game-core': path.join(monorepoRoot, 'packages/game-core/src/index.ts'),
      '@princefall/shared': path.join(monorepoRoot, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    fs: {
      allow: [monorepoRoot],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    commonjsOptions: {
      include: [/game-core/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['@princefall/game-core'],
  },
});
