import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.match(/src\/.*\.(js|jsx)$/)) return null

        // Use esbuild to transform JSX
        const esbuild = await import('esbuild')
        const result = await esbuild.transform(code, {
          loader: 'jsx',
          jsx: 'automatic',
          jsxImportSource: 'react',
        })
        return {
          code: result.code,
          map: null, // Let Vite handle sourcemaps
        }
      },
    },
    react(),
  ],
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to Wrangler dev server
      '/geocode': 'http://localhost:8788',
      '/distance': 'http://localhost:8788',
      '/llm-search': 'http://localhost:8788',
      '/sendEmail': 'http://localhost:8788',
      '/createPdf': 'http://localhost:8788',
      '/log-usage': 'http://localhost:8788',
      '/sendSupportEmail': 'http://localhost:8788',
      '/training-request': 'http://localhost:8788',
      '/track-calendar-add': 'http://localhost:8788',
      // News feed data for the /news page + chyron. NOTE: proxy '/news-feed',
      // never '/news' — /news is the React page route and must stay with Vite.
      '/news-feed': 'http://localhost:8788',
      // Admin review API (behind the session cookie + admin account gate).
      // Same rule: '/admin-findings', never '/admin' (that's the page route).
      '/admin-findings': 'http://localhost:8788',
      // Auth endpoints (Set-Cookie / Cookie pass through fine; default
      // proxy preserves them, and we don't set Domain on the cookie so the
      // browser ties it to the request origin — localhost:3000 in dev).
      '/login': 'http://localhost:8788',
      '/logout': 'http://localhost:8788',
      '/whoami': 'http://localhost:8788',
      '/list-orgs': 'http://localhost:8788',
      '/list-org-colors': 'http://localhost:8788',
    },
  },
  build: {
    outDir: 'build',
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
})
