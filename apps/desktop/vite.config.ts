import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

const studio = process.env.ERIS_STUDIO_OUT

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.includes("node_modules") ? undefined : true,
      },

      adapter: adapter({
        pages: studio,
        assets: studio,
        fallback: "index.html",
      }),

      paths: { base: studio ? "/studio" : "" },
    }),
  ],

  clearScreen: false,

  server: {
    port: 1430,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
