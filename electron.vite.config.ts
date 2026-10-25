import { resolve } from 'path'
import fs from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Simple plugin to ensure sql-wasm.wasm is copied next to out/main/
function copySqlWasmPlugin() {
  return {
    name: 'copy-sql-wasm',
    closeBundle() {
      const srcWasm = resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
      const destDir = resolve(__dirname, 'out/main')
      if (fs.existsSync(srcWasm)) {
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true })
        }
        fs.copyFileSync(srcWasm, resolve(destDir, 'sql-wasm.wasm'))
      }

      // Copy export-powerpoint.ps1
      const srcPs1 = resolve(__dirname, 'src/main/powerpoint/scripts/export-powerpoint.ps1')
      const destScriptsDir = resolve(__dirname, 'out/main/scripts')
      if (fs.existsSync(srcPs1)) {
        if (!fs.existsSync(destScriptsDir)) {
          fs.mkdirSync(destScriptsDir, { recursive: true })
        }
        fs.copyFileSync(srcPs1, resolve(destScriptsDir, 'export-powerpoint.ps1'))
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copySqlWasmPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    }
  }
})
