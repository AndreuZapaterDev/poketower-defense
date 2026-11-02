import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0', // accesible desde fuera del contenedor
    port: 9000,
    strictPort: true,
    watch: {
      usePolling: true, // los eventos de fichero de Windows no llegan al contenedor
      interval: 300,
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000, // Phaser por sí solo ocupa ~1,5 MB
  },
});
