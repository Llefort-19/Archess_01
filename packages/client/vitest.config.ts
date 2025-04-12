/// <reference types="vitest" />
/// <reference types="vite/client" />

// packages/client/vitest.config.ts
import { defineConfig } from 'vitest/config'
// import react from '@vitejs/plugin-react' // Removed plugin
import path from 'path'

export default defineConfig({
  // plugins: [react() as any], // Removed plugins array
  test: {
    globals: true, // Use Vitest global APIs (describe, test, expect, etc.)
    environment: 'jsdom', // Simulate browser environment for React components
    setupFiles: './src/setupTests.ts', // Optional: Setup file for test environment (e.g., extending expect)
    css: false, // Disable CSS processing if not needed for tests
    alias: {
      // Ensure aliases match tsconfig.json if you use them
       '@': path.resolve(__dirname, './src'),
       // Add alias for shared package
       '@archess/shared': path.resolve(__dirname, '../shared/src') 
    },
  },
}) 