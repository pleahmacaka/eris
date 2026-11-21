import { icons as lucide } from "@iconify-json/lucide"
import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { iconifyEmbed } from "./tools/iconify-embed.ts"

export default defineConfig({
  plugins: [
    iconifyEmbed({ collections: [lucide], scan: ["src"] }),
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter({
        pages: "build",
        assets: "build",
        fallback: "index.html",
      }),
    }),
  ],

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
