import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { COVER_SCHEME } from './src/shared/ipc'

/** CSP restritiva só no build (em dev o Vite precisa de scripts inline para o HMR). */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${COVER_SCHEME}: https:`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'"
  ].join('; ')
  return {
    name: 'relaunch-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
  }
}

export default defineConfig({
  main: {
    build: {
      // electron-store e conf são ESM-only: empacotamos no bundle do processo principal (CJS).
      externalizeDeps: { exclude: ['electron-store', 'conf'] },
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    // IPv4 explícito: evita "localhost" resolvido para ::1 em máquinas sem IPv6.
    server: { host: '127.0.0.1' },
    plugins: [react(), tailwindcss(), contentSecurityPolicy()],
    build: {
      minify: true,
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
})
