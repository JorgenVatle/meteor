import { defineConfig } from 'vite'
import { meteor } from 'meteor-vite/plugin';
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
    meteor({
      clientEntry: 'imports/ui/main.js'
    })
  ],
  optimizeDeps: {
    exclude: ['vue-meteor-tracker'],
  },
})
