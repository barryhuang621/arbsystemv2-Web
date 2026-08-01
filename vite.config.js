import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true, // 相容網路磁碟機 (NAS / Z:\ 磁碟) 的檔案監聽模式
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
