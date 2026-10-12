import { hasOwnIcon, type Item } from "./items"
import { extensionOf } from "./locations"

const FOLDERS: Record<string, string> = {
  ".git": "lucide:folder-git-2",
  ".github": "lucide:folder-git-2",
  ".gitlab": "lucide:folder-git-2",
  src: "lucide:folder-code",
  lib: "lucide:folder-code",
  app: "lucide:folder-code",
  apps: "lucide:folder-code",
  packages: "lucide:folder-code",
  components: "lucide:folder-code",
  scripts: "lucide:folder-cog",
  config: "lucide:folder-cog",
  ".config": "lucide:folder-cog",
  ".vscode": "lucide:folder-cog",
  ".idea": "lucide:folder-cog",
  test: "lucide:folder-check",
  tests: "lucide:folder-check",
  __tests__: "lucide:folder-check",
  node_modules: "lucide:folder-archive",
  vendor: "lucide:folder-archive",
  target: "lucide:folder-archive",
  dist: "lucide:folder-archive",
  build: "lucide:folder-archive",
  out: "lucide:folder-archive",
  ".venv": "lucide:folder-archive",
  venv: "lucide:folder-archive",
  ".ssh": "lucide:folder-lock",
  secrets: "lucide:folder-lock",
}

const NAMES: Record<string, string> = {
  ".gitignore": "simple-icons:git",
  ".gitattributes": "simple-icons:git",
  ".gitmodules": "simple-icons:git",
  ".gitkeep": "simple-icons:git",
  dockerfile: "simple-icons:docker",
  "docker-compose.yml": "simple-icons:docker",
  "compose.yaml": "simple-icons:docker",
  ".dockerignore": "simple-icons:docker",
  "package.json": "simple-icons:npm",
  "package-lock.json": "simple-icons:npm",
  "bun.lock": "simple-icons:bun",
  "bun.lockb": "simple-icons:bun",
  "uv.lock": "simple-icons:uv",
  "pyproject.toml": "simple-icons:python",
  ".python-version": "simple-icons:python",
  "requirements.txt": "simple-icons:python",
  "cargo.toml": "simple-icons:rust",
  "cargo.lock": "simple-icons:rust",
  "tsconfig.json": "simple-icons:typescript",
  "biome.json": "simple-icons:biome",
  "vite.config.ts": "simple-icons:vite",
  "vite.config.js": "simple-icons:vite",
  "cmakelists.txt": "simple-icons:cmake",
  "build.gradle": "simple-icons:gradle",
  "build.gradle.kts": "simple-icons:gradle",
  makefile: "lucide:file-cog",
  license: "lucide:scale",
  "license.md": "lucide:scale",
  "license.txt": "lucide:scale",
}

const EXTENSIONS: Record<string, string> = {
  ".py": "simple-icons:python",
  ".pyi": "simple-icons:python",
  ".ipynb": "simple-icons:jupyter",
  ".rs": "simple-icons:rust",
  ".ts": "simple-icons:typescript",
  ".mts": "simple-icons:typescript",
  ".cts": "simple-icons:typescript",
  ".tsx": "simple-icons:react",
  ".jsx": "simple-icons:react",
  ".js": "simple-icons:javascript",
  ".mjs": "simple-icons:javascript",
  ".cjs": "simple-icons:javascript",
  ".svelte": "simple-icons:svelte",
  ".vue": "simple-icons:vuedotjs",
  ".go": "simple-icons:go",
  ".java": "simple-icons:openjdk",
  ".kt": "simple-icons:kotlin",
  ".kts": "simple-icons:kotlin",
  ".c": "simple-icons:c",
  ".h": "simple-icons:c",
  ".cpp": "simple-icons:cplusplus",
  ".cc": "simple-icons:cplusplus",
  ".hpp": "simple-icons:cplusplus",
  ".cs": "simple-icons:dotnet",
  ".rb": "simple-icons:ruby",
  ".php": "simple-icons:php",
  ".swift": "simple-icons:swift",
  ".dart": "simple-icons:dart",
  ".lua": "simple-icons:lua",
  ".nix": "simple-icons:nixos",
  ".md": "simple-icons:markdown",
  ".mdx": "simple-icons:markdown",
  ".toml": "simple-icons:toml",
  ".yaml": "simple-icons:yaml",
  ".yml": "simple-icons:yaml",
  ".html": "simple-icons:html5",
  ".htm": "simple-icons:html5",
  ".css": "simple-icons:css",
  ".scss": "simple-icons:sass",
  ".sass": "simple-icons:sass",
  ".json": "lucide:braces",
  ".jsonc": "lucide:braces",
  ".xml": "lucide:code-xml",
  ".svg": "lucide:code-xml",
  ".sh": "lucide:file-terminal",
  ".bash": "lucide:file-terminal",
  ".zsh": "lucide:file-terminal",
  ".fish": "lucide:file-terminal",
  ".ps1": "lucide:file-terminal",
  ".bat": "lucide:file-terminal",
  ".cmd": "lucide:file-terminal",
  ".sql": "lucide:database",
  ".db": "lucide:database",
  ".sqlite": "lucide:database",
  ".csv": "lucide:file-spreadsheet",
  ".tsv": "lucide:file-spreadsheet",
  ".xls": "lucide:file-spreadsheet",
  ".xlsx": "lucide:file-spreadsheet",
  ".txt": "lucide:file-text",
  ".log": "lucide:file-text",
  ".pdf": "lucide:file-text",
  ".doc": "lucide:file-text",
  ".docx": "lucide:file-text",
  ".hwp": "lucide:file-text",
  ".hwpx": "lucide:file-text",
  ".ppt": "lucide:file-text",
  ".pptx": "lucide:file-text",
  ".lock": "lucide:lock",
  ".msi": "lucide:package",
  ".env": "lucide:file-key",
  ".pem": "lucide:file-key",
  ".key": "lucide:file-key",
  ".ini": "lucide:file-cog",
  ".cfg": "lucide:file-cog",
  ".conf": "lucide:file-cog",
  ".png": "lucide:file-image",
  ".jpg": "lucide:file-image",
  ".jpeg": "lucide:file-image",
  ".gif": "lucide:file-image",
  ".webp": "lucide:file-image",
  ".bmp": "lucide:file-image",
  ".avif": "lucide:file-image",
  ".heic": "lucide:file-image",
  ".psd": "lucide:file-image",
  ".mp4": "lucide:file-video",
  ".mkv": "lucide:file-video",
  ".mov": "lucide:file-video",
  ".avi": "lucide:file-video",
  ".webm": "lucide:file-video",
  ".mp3": "lucide:file-audio",
  ".wav": "lucide:file-audio",
  ".flac": "lucide:file-audio",
  ".m4a": "lucide:file-audio",
  ".ogg": "lucide:file-audio",
  ".zip": "lucide:file-archive",
  ".7z": "lucide:file-archive",
  ".rar": "lucide:file-archive",
  ".tar": "lucide:file-archive",
  ".gz": "lucide:file-archive",
  ".xz": "lucide:file-archive",
  ".ttf": "lucide:file-type",
  ".otf": "lucide:file-type",
  ".woff": "lucide:file-type",
  ".woff2": "lucide:file-type",
}

export const isBrand = (icon: string) => icon.startsWith("simple-icons:")

export const ideIcon = (item: Item) => {
  if (item.drive || item.key.startsWith("pidl:") || hasOwnIcon(item)) {
    return null
  }

  const name = item.name.toLowerCase()

  if (item.link) {
    return item.dir ? "lucide:folder-symlink" : "lucide:file-symlink"
  }

  if (item.dir) {
    return FOLDERS[name] ?? "lucide:folder"
  }

  if (name.startsWith("readme")) {
    return "lucide:info"
  }

  if (name.startsWith(".env")) {
    return "lucide:file-key"
  }

  return NAMES[name] ?? EXTENSIONS[extensionOf(name)] ?? "lucide:file"
}
