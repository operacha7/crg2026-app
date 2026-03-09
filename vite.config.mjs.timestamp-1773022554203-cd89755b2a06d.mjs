// vite.config.mjs
import { defineConfig } from "file:///sessions/friendly-adoring-fermat/mnt/crg2026-app/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/friendly-adoring-fermat/mnt/crg2026-app/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    {
      name: "treat-js-files-as-jsx",
      enforce: "pre",
      async transform(code, id) {
        if (!id.match(/src\/.*\.(js|jsx)$/)) return null;
        const esbuild = await import("file:///sessions/friendly-adoring-fermat/mnt/crg2026-app/node_modules/esbuild/lib/main.js");
        const result = await esbuild.transform(code, {
          loader: "jsx",
          jsx: "automatic",
          jsxImportSource: "react"
        });
        return {
          code: result.code,
          map: null
          // Let Vite handle sourcemaps
        };
      }
    },
    react()
  ],
  server: {
    port: 3e3,
    proxy: {
      // Proxy API requests to Wrangler dev server
      "/geocode": "http://localhost:8788",
      "/distance": "http://localhost:8788",
      "/llm-search": "http://localhost:8788",
      "/sendEmail": "http://localhost:8788",
      "/createPdf": "http://localhost:8788",
      "/log-usage": "http://localhost:8788",
      "/sendSupportEmail": "http://localhost:8788"
    }
  },
  build: {
    outDir: "build"
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL3Nlc3Npb25zL2ZyaWVuZGx5LWFkb3JpbmctZmVybWF0L21udC9jcmcyMDI2LWFwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL2ZyaWVuZGx5LWFkb3JpbmctZmVybWF0L21udC9jcmcyMDI2LWFwcC92aXRlLmNvbmZpZy5tanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL2ZyaWVuZGx5LWFkb3JpbmctZmVybWF0L21udC9jcmcyMDI2LWFwcC92aXRlLmNvbmZpZy5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAge1xuICAgICAgbmFtZTogJ3RyZWF0LWpzLWZpbGVzLWFzLWpzeCcsXG4gICAgICBlbmZvcmNlOiAncHJlJyxcbiAgICAgIGFzeW5jIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgICBpZiAoIWlkLm1hdGNoKC9zcmNcXC8uKlxcLihqc3xqc3gpJC8pKSByZXR1cm4gbnVsbFxuXG4gICAgICAgIC8vIFVzZSBlc2J1aWxkIHRvIHRyYW5zZm9ybSBKU1hcbiAgICAgICAgY29uc3QgZXNidWlsZCA9IGF3YWl0IGltcG9ydCgnZXNidWlsZCcpXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGVzYnVpbGQudHJhbnNmb3JtKGNvZGUsIHtcbiAgICAgICAgICBsb2FkZXI6ICdqc3gnLFxuICAgICAgICAgIGpzeDogJ2F1dG9tYXRpYycsXG4gICAgICAgICAganN4SW1wb3J0U291cmNlOiAncmVhY3QnLFxuICAgICAgICB9KVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGNvZGU6IHJlc3VsdC5jb2RlLFxuICAgICAgICAgIG1hcDogbnVsbCwgLy8gTGV0IFZpdGUgaGFuZGxlIHNvdXJjZW1hcHNcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9LFxuICAgIHJlYWN0KCksXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDMwMDAsXG4gICAgcHJveHk6IHtcbiAgICAgIC8vIFByb3h5IEFQSSByZXF1ZXN0cyB0byBXcmFuZ2xlciBkZXYgc2VydmVyXG4gICAgICAnL2dlb2NvZGUnOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg4JyxcbiAgICAgICcvZGlzdGFuY2UnOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg4JyxcbiAgICAgICcvbGxtLXNlYXJjaCc6ICdodHRwOi8vbG9jYWxob3N0Ojg3ODgnLFxuICAgICAgJy9zZW5kRW1haWwnOiAnaHR0cDovL2xvY2FsaG9zdDo4Nzg4JyxcbiAgICAgICcvY3JlYXRlUGRmJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4OCcsXG4gICAgICAnL2xvZy11c2FnZSc6ICdodHRwOi8vbG9jYWxob3N0Ojg3ODgnLFxuICAgICAgJy9zZW5kU3VwcG9ydEVtYWlsJzogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODc4OCcsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBvdXREaXI6ICdidWlsZCcsXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGVzYnVpbGRPcHRpb25zOiB7XG4gICAgICBsb2FkZXI6IHtcbiAgICAgICAgJy5qcyc6ICdqc3gnLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBdVUsU0FBUyxvQkFBb0I7QUFDcFcsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxNQUFNLFVBQVUsTUFBTSxJQUFJO0FBQ3hCLFlBQUksQ0FBQyxHQUFHLE1BQU0sb0JBQW9CLEVBQUcsUUFBTztBQUc1QyxjQUFNLFVBQVUsTUFBTSxPQUFPLDJGQUFTO0FBQ3RDLGNBQU0sU0FBUyxNQUFNLFFBQVEsVUFBVSxNQUFNO0FBQUEsVUFDM0MsUUFBUTtBQUFBLFVBQ1IsS0FBSztBQUFBLFVBQ0wsaUJBQWlCO0FBQUEsUUFDbkIsQ0FBQztBQUNELGVBQU87QUFBQSxVQUNMLE1BQU0sT0FBTztBQUFBLFVBQ2IsS0FBSztBQUFBO0FBQUEsUUFDUDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSxNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsTUFFTCxZQUFZO0FBQUEsTUFDWixhQUFhO0FBQUEsTUFDYixlQUFlO0FBQUEsTUFDZixjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxxQkFBcUI7QUFBQSxJQUN2QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixnQkFBZ0I7QUFBQSxNQUNkLFFBQVE7QUFBQSxRQUNOLE9BQU87QUFBQSxNQUNUO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
