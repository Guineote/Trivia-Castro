import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Raíz del repo: las fixtures del mock se importan desde docs/contrato/ejemplos.
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@contrato': fileURLToPath(new URL('../docs/contrato/ejemplos', import.meta.url)),
    },
  },
  server: {
    fs: { allow: [repoRoot] },
    // Confirmar puerto de la API con Jared (se asume 8000).
    proxy: { '/api': 'http://localhost:8000' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
