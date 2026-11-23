import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// The product site (landing, /try simulator, FAQ, privacy). The glasses app keeps its own build (vite.config.ts → dist).
// On /try the real app (src/main.ts) runs against a stand-in SDK that draws the G2 display in the page.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: r('./site'),
  publicDir: r('./site/public'),
  server: { host: '127.0.0.1', port: 5192, strictPort: true },
  resolve: {
    alias: [
      { find: '@evenrealities/even_hub_sdk', replacement: r('./site/sim/sdk.ts') },
      { find: /^\.\/ui$/, replacement: r('./site/sim/ui.ts') },
    ],
  },
  build: {
    target: 'esnext',
    outDir: r('./dist-site'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: r('./site/index.html'),
        try: r('./site/try.html'),
        faq: r('./site/faq.html'),
        privacy: r('./site/privacy.html'),
        404: r('./site/404.html'),
      },
    },
  },
})
