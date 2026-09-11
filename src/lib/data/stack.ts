export type Part = string | { text: string; href: string }

export type Capability = {
  title: string
  body: Part[]
  stack: string[]
}

export const capabilities: Capability[] = [
  {
    title: "Desktop apps",
    body: [
      "A shell replacement for Windows (",
      { text: "Eris", href: "https://github.com/pleahmacaka/eris" },
      ") and a local-first SQL client (",
      { text: "GPQL", href: "https://gpql.dev" },
      "). Rust core, web UI, one binary per platform, starting from ",
      {
        text: "svelte-tauri-template",
        href: "https://github.com/pleahmacaka/svelte-tauri-template",
      },
      ".",
    ],
    stack: ["Tauri 2", "Rust", "Svelte 5", "TypeScript"],
  },
  {
    title: "Packages on npm",
    body: [
      { text: "tailnet", href: "https://github.com/pleahmacaka/tailnet" },
      " is five packages covering Tailscale, Headscale and the daemon on your machine, behind one shared contract. Every method that writes carries a risk line you see on hover.",
    ],
    stack: ["TypeScript", "Bun", "npm"],
  },
  {
    title: "Web",
    body: [
      "SvelteKit end to end, on Vercel behind Cloudflare DNS. This page is one of them: two live contribution feeds, no client-side data fetching.",
    ],
    stack: ["SvelteKit", "TailwindCSS", "DaisyUI", "Vercel"],
  },
  {
    title: "Data",
    body: [
      "Schema written in code, migrations generated from it, queries through the builder instead of SQL strings. Supabase when auth and storage should come in the same box.",
    ],
    stack: ["PostgreSQL", "SQLite", "Drizzle", "Supabase"],
  },
  {
    title: "Models on device",
    body: [
      { text: "sam3.dxnn", href: "https://github.com/pleahmacaka/sam3.dxnn" },
      " compiles the SAM3 vision encoder to run entirely on a DeepX DX-M1 NPU: export, quantize, calibrate, then measure it against the CPU baseline. Notes on the wider silicon in ",
      {
        text: "awesome-npu",
        href: "https://github.com/pleahmacaka/awesome-npu",
      },
      ".",
    ],
    stack: ["Python", "PyTorch", "ONNX", "uv"],
  },
  {
    title: "Editor and machine setup",
    body: [
      "Zed extensions and a Tree-sitter grammar for Windows Batch (",
      { text: "zed-batch", href: "https://github.com/pleahmacaka/zed-batch" },
      "), and a NixOS configuration that rebuilds a machine from one flake (",
      { text: "dotfiles", href: "https://github.com/pleahmacaka/dotfiles" },
      ").",
    ],
    stack: ["Nix", "Tree-sitter", "Rust", "GitHub Actions"],
  },
]
