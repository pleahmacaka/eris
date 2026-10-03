import { paraglideVitePlugin } from "@inlang/paraglide-js"
import adapter from "@sveltejs/adapter-vercel"
import { sveltekit } from "@sveltejs/kit/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    tailwindcss(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/lib/paraglide",
      strategy: ["url", "preferredLanguage", "baseLocale"],
      urlPatterns: [
        {
          pattern: "/:path(.*)?",
          localized: [
            ["ko", "/ko/:path(.*)?"],
            ["ja", "/ja/:path(.*)?"],
            ["zh", "/zh/:path(.*)?"],
            ["en", "/:path(.*)?"],
          ],
        },
      ],
    }),
    sveltekit({
      compilerOptions: {
        runes: ({ filename }) =>
          filename.includes("node_modules") ? undefined : true,
      },
      adapter: adapter({ runtime: "nodejs24.x" }),
    }),
  ],
})
