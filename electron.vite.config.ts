import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { COVER_SCHEME } from './src/shared/ipc'

/**
 * CSP restritiva só no build (em dev o Vite precisa de scripts inline para o HMR).
 * Nega tudo por padrão (fetch, iframes, workers...); imagens remotas só do GitHub (notas de release).
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: ${COVER_SCHEME}: https://github.com https://*.githubusercontent.com`,
    "font-src 'self' data:",
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
      // Dependências JS puras entram no bundle: carregar node_modules na abertura custa ~100 ms.
      // (electron-store e conf também são ESM-only.) Ficam de fora o 7zip-bin (binário em disco)
      // e o electron-updater (carregado só quando preciso).
      externalizeDeps: { exclude: ['electron-store', 'conf', 'zod', 'picomatch', 'tar', 'yauzl', 'yazl'] },
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
