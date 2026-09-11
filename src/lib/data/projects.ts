import * as m from "$lib/paraglide/messages"

export type Project = {
  name: string
  href: string
  body: () => string
  stack: string[]
}

export const projects: Project[] = [
  {
    name: "Eris",
    href: "https://github.com/pleahmacaka/eris",
    body: m.project_eris,
    stack: ["Tauri 2", "Rust", "Svelte 5", "TypeScript"],
  },
  {
    name: "GPQL",
    href: "https://gpql.dev",
    body: m.project_gpql,
    stack: ["Tauri 2", "SvelteKit", "Drizzle", "Effect"],
  },
  {
    name: "tailnet",
    href: "https://github.com/pleahmacaka/tailnet",
    body: m.project_tailnet,
    stack: ["TypeScript", "Bun", "npm"],
  },
  {
    name: "sam3.dxnn",
    href: "https://github.com/pleahmacaka/sam3.dxnn",
    body: m.project_sam3,
    stack: ["Python", "PyTorch", "ONNX", "uv"],
  },
  {
    name: "zed-batch",
    href: "https://github.com/pleahmacaka/zed-batch",
    body: m.project_zed,
    stack: ["Rust", "Tree-sitter"],
  },
  {
    name: "dotfiles",
    href: "https://github.com/pleahmacaka/dotfiles",
    body: m.project_dotfiles,
    stack: ["Nix", "NixOS"],
  },
]
