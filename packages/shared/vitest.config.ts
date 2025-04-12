import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Use Node.js environment
     alias: {
       // Ensure aliases match tsconfig.json if you use them
       '@': path.resolve(__dirname, './src'),
    },
  },
}) 