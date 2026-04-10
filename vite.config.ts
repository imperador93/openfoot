import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'

import pkg from './package.json'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), Icons({ compiler: 'jsx', jsx: 'react' })],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // Configurações do Vite adaptadas para desenvolvimento Tauri, aplicadas apenas em `tauri dev` ou `tauri build`
  //
  // 1. Previne que o Vite oculte erros do Rust
  clearScreen: false,
  // 2. O Tauri espera uma porta fixa. Falha se essa porta não estiver disponível
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. Diz ao Vite para ignorar alterações na pasta `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
}))
