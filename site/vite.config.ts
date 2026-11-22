import { icons as lucide } from "@iconify-json/lucide"
import { icons as mdi } from "@iconify-json/mdi"
import adapter from "@sveltejs/adapter-static"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { iconifyEmbed } from "./tools/iconify-embed.ts"

const DEFAULT_ORIGIN = "https://eris.arixlab.com"

const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL

const origin =
  process.env.SITE_URL ??
  (vercelDomain ? `https://${vercelDomain}` : DEFAULT_ORIGIN)

export default defineConfig({
  plugins: [
    iconifyEmbed({ collections: [lucide, mdi], scan: ["src"] }),
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter({ pages: "build", assets: "build" }),
      inlineStyleThreshold: Number.POSITIVE_INFINITY,
      paths: { origin },
    }),
  ],
})
