import { defineConfig } from 'vite';

export default defineConfig({
  base: '/xiu-xian-roguelike/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    port: 3000,
    open: true,
  },
});
