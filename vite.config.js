import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: project site at username.github.io/cmpgvng
export default defineConfig({
  plugins: [react()],
  base: '/cmpgvng/',
})
