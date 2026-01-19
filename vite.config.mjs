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
      '/llm-search': 'http://localhost:8788',
      '/sendEmail': 'http://localhost:8788',
      '/createPdf': 'http://localhost:8788',
      '/log-usage': 'http://localhost:8788',
      '/sendSupportEmail': 'http://localhost:8788',
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
