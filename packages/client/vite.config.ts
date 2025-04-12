import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Default Vite port
    // Optional: Proxy API requests to the backend during development
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:3001', // Your backend server
    //     changeOrigin: true,
    //     // rewrite: (path) => path.replace(/^\/api/, '')
    //   }
    // }
  },
  resolve: {
    alias: {
      // Example alias - adjust if needed
      // '@': path.resolve(__dirname, './src'),
    },
  },
  // Tell Vite *not* to pre-bundle the workspace package
  optimizeDeps: {
    exclude: ['@archess/shared'],
  },
  build: {
    // Ensure shared package is part of the build
    commonjsOptions: {
      include: [/@archess\/shared/, /* /node_modules/ */],
    },
  },
}) 