import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/scan': 'http://localhost:8000',
      '/status': 'http://localhost:8000',
      '/results': 'http://localhost:8000',
      '/delete': 'http://localhost:8000',
      '/file': 'http://localhost:8000',
      '/reveal': 'http://localhost:8000',
      '/validate_path': 'http://localhost:8000',
      '/remove_json': 'http://localhost:8000',
      '/remove_prefix': 'http://localhost:8000',
    }
  }
})
