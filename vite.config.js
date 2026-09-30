/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

// CSP apenas no build de produção: em dev o Vite/react-refresh injeta scripts
// inline e liga por websocket, incompatíveis com uma política estrita.
// `connect-src` inclui as APIs públicas para o fallback de browser (sem IPC);
// no Electron empacotado as chamadas de rede passam pelo main process.
const cspPlugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml() {
    return [{
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content: [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://api.frankfurter.dev https://api.coingecko.com https://ec.europa.eu https://data-api.ecb.europa.eu",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
      injectTo: 'head-prepend',
    }]
  },
}

export default defineConfig({
  plugins: [react(), cspPlugin],
  base: './',
  server: { port: 5173 },
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      output: {
        // Separa os vendors pesados do chunk principal: carregamento em
        // paralelo e o aviso de chunk >500 kB desaparece.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
          if (/[\\/](recharts|victory-vendor|d3-[^\\/]+|react-smooth|recharts-scale|decimal\.js-light|fast-equals)[\\/]/.test(id)) return 'vendor-charts'
          if (id.includes('lucide-react')) return 'vendor-icons'
          return undefined
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}', 'electron/**/*.{test,spec}.js'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/utils/calc/**'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
      reporter: ['text', 'html'],
    },
  },
})
