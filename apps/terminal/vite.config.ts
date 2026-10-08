import { icons as lucide } from "@iconify-json/lucide"
import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { iconifySubset } from "vite-plugin-iconify-subset"

export default defineConfig({
  plugins: [
    iconifySubset({
      collections: [lucide],
      scan: ["src", "../../packages/ui/src", "../../packages/terminal/src"],
    }),
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
    port: 1450,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
})
