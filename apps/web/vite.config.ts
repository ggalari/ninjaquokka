import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // The browser only talks to /api; Vite forwards it to the API, so no CORS setup needed.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
