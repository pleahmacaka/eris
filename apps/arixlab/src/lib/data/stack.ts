import * as m from "$lib/paraglide/messages"

export type Group = {
  label: () => string
  items: string[]
}

export const groups: Group[] = [
  {
    label: m.stack_languages,
    items: ["TypeScript", "Rust", "Python", "C", "Kotlin"],
  },
  {
    label: m.stack_frontend,
    items: [
      "Svelte 5",
      "SvelteKit",
      "TailwindCSS",
      "DaisyUI",
      "Threlte",
      "LayerChart",
      "Plotly",
    ],
  },
  {
    label: m.stack_desktop,
    items: ["Tauri 2", "Rust"],
  },
  {
    label: m.stack_embedded,
    items: ["C", "Zephyr RTOS"],
  },
  {
    label: m.stack_data,
    items: ["PostgreSQL", "SQLite", "Drizzle", "Supabase"],
  },
  {
    label: m.stack_ml,
    items: ["PyTorch", "ONNX"],
  },
  {
    label: m.stack_tooling,
    items: [
      "Bun",
      "uv",
      "Nix",
      "Biome",
      "Podman",
      "GitHub Actions",
      "Vercel",
      "Cloudflare",
    ],
  },
]
