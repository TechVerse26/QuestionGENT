import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// URL path the site is served from.
// - local dev and Vercel: '/' (default)
// - GitHub Pages project site (https://USER.github.io/REPO/): the deploy workflow sets BASE_PATH=/REPO/ by itself
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase';
          if (id.includes('/@tiptap/') || id.includes('/prosemirror-')) return 'editor';
          if (id.includes('/recharts/') || id.includes('/d3-')) return 'charts';
          if (id.includes('/docx/') || id.includes('/jszip/')) return 'export';
          return undefined;
        },
      },
    },
  },
});
