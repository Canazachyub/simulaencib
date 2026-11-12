import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Servido en la raíz de banqueo.sinapsisedu.com
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
