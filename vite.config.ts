import { defineConfig } from 'vite'

// Port 5191 on loopback only (5173 is used by another project on this machine).
export default defineConfig({
  server: { host: '127.0.0.1', port: 5191, strictPort: true },
  build: { target: 'esnext' },
})
