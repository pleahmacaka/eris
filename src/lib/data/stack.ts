import * as m from "$lib/paraglide/messages"

export type Capability = {
  title: () => string
  body: () => string
  links: Record<string, { label: string; href: string }>
  stack: string[]
}

export const capabilities: Capability[] = [
  {
    title: m.card_desktop_title,
    body: m.card_desktop_body,
    links: {
      eris: { label: "Eris", href: "https://github.com/pleahmacaka/eris" },
      gpql: { label: "GPQL", href: "https://gpql.dev" },
      template: {
        label: "svelte-tauri-template",
        href: "https://github.com/pleahmacaka/svelte-tauri-template",
      },
    },
    stack: ["Tauri 2", "Rust", "Svelte 5", "TypeScript"],
  },
  {
    title: m.card_packages_title,
    body: m.card_packages_body,
    links: {
      tailnet: {
        label: "tailnet",
        href: "https://github.com/pleahmacaka/tailnet",
      },
    },
    stack: ["TypeScript", "Bun", "npm"],
  },
  {
    title: m.card_web_title,
    body: m.card_web_body,
    links: {},
    stack: ["SvelteKit", "TailwindCSS", "DaisyUI", "Vercel"],
  },
  {
    title: m.card_data_title,
    body: m.card_data_body,
    links: {},
    stack: ["PostgreSQL", "SQLite", "Drizzle", "Supabase"],
  },
  {
    title: m.card_models_title,
    body: m.card_models_body,
    links: {
      sam3: {
        label: "sam3.dxnn",
        href: "https://github.com/pleahmacaka/sam3.dxnn",
      },
      npu: {
        label: "awesome-npu",
        href: "https://github.com/pleahmacaka/awesome-npu",
      },
    },
    stack: ["Python", "PyTorch", "ONNX", "uv"],
  },
  {
    title: m.card_tooling_title,
    body: m.card_tooling_body,
    links: {
      zedbatch: {
        label: "zed-batch",
        href: "https://github.com/pleahmacaka/zed-batch",
      },
      dotfiles: {
        label: "dotfiles",
        href: "https://github.com/pleahmacaka/dotfiles",
      },
    },
    stack: ["Nix", "Tree-sitter", "Rust", "GitHub Actions"],
  },
]
