import { icons as lucide } from "@iconify-json/lucide"
import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { iconifySubset } from "vite-plugin-iconify-subset"

const studio = process.env.ERIS_STUDIO_OUT

export default defineConfig({
  plugins: [
    iconifySubset({
      collections: [lucide],
      scan: [
        "src",
        "../../packages/ui/src",
        "../../packages/terminal/src",
        "../../packages/files/src",
        "../../packages/model-viewer/src",
      ],
    }),
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
