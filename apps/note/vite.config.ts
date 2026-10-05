import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const host = process.env.TAURI_DEV_HOST

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.includes("node_modules") ? undefined : true,
      },

      adapter: adapter({ fallback: "index.html" }),
    }),
  ],

  clearScreen: false,

  server: {
    port: 47823,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 47824 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
