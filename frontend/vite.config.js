import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  server: {
    host: '0.0.0.0',  // Allow external connections (needed for Docker)
    port: 5173,       // Your preferred port
    watch: {
      usePolling: true  // Needed for hot reload in Docker on some systems
    }
  }
}) 