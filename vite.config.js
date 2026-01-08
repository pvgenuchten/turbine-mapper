import { defineConfig } from 'vite'

export default {
  base: '/turbine-mapper/',  // 👈 set this to your repo name
  resolve: {
    alias: {
      stream: "stream-browserify",
      buffer: "buffer"
    }
  },
  optimizeDeps: {
    include: ["jszip"]
  },
  define: {
    global: "window"
  }
}
