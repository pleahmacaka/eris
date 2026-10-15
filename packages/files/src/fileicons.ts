import { hasOwnIcon, type Item } from "./items"
import { extensionOf } from "./locations"
import { lacksSystemIcon } from "./store/generic-icons.svelte"

const FOLDERS: Record<string, string> = {
  ".git": "material-icon-theme:folder-git",
  ".github": "material-icon-theme:folder-github",
  ".gitlab": "material-icon-theme:folder-gitlab",
  src: "material-icon-theme:folder-src",
  lib: "material-icon-theme:folder-lib",
  app: "material-icon-theme:folder-app",
  apps: "material-icon-theme:folder-app",
  packages: "material-icon-theme:folder-packages",
  components: "material-icon-theme:folder-components",
  scripts: "material-icon-theme:folder-scripts",
  config: "material-icon-theme:folder-config",
  ".config": "material-icon-theme:folder-config",
  ".vscode": "material-icon-theme:folder-vscode",
  ".idea": "material-icon-theme:folder-intellij",
  test: "material-icon-theme:folder-test",
  tests: "material-icon-theme:folder-test",
  __tests__: "material-icon-theme:folder-test",
  coverage: "material-icon-theme:folder-coverage",
  node_modules: "material-icon-theme:folder-node",
  dist: "material-icon-theme:folder-dist",
  build: "material-icon-theme:folder-dist",
  out: "material-icon-theme:folder-dist",
  target: "material-icon-theme:folder-target",
  ".venv": "material-icon-theme:folder-python",
  venv: "material-icon-theme:folder-python",
  ".ssh": "material-icon-theme:folder-secure",
  secrets: "material-icon-theme:folder-secure",
}

const NAMES: Record<string, string> = {
  ".gitignore": "material-icon-theme:git",
  ".gitattributes": "material-icon-theme:git",
  ".gitmodules": "material-icon-theme:git",
  ".gitkeep": "material-icon-theme:git",
  dockerfile: "material-icon-theme:docker",
  "docker-compose.yml": "material-icon-theme:docker",
  "compose.yaml": "material-icon-theme:docker",
  ".dockerignore": "material-icon-theme:docker",
  ".editorconfig": "material-icon-theme:editorconfig",
  ".prettierrc": "material-icon-theme:prettier",
  ".npmrc": "material-icon-theme:npm",
  "package.json": "material-icon-theme:nodejs",
  "package-lock.json": "material-icon-theme:npm",
  "pnpm-lock.yaml": "material-icon-theme:pnpm",
  "yarn.lock": "material-icon-theme:yarn",
  "bun.lock": "material-icon-theme:bun",
  "bun.lockb": "material-icon-theme:bun",
  "uv.lock": "material-icon-theme:uv",
  "pyproject.toml": "material-icon-theme:python",
  ".python-version": "material-icon-theme:python",
  "requirements.txt": "material-icon-theme:python",
  "cargo.toml": "material-icon-theme:rust",
  "cargo.lock": "material-icon-theme:rust",
  "tsconfig.json": "material-icon-theme:tsconfig",
  "biome.json": "material-icon-theme:biome",
  "vite.config.ts": "material-icon-theme:vite",
  "vite.config.js": "material-icon-theme:vite",
  "cmakelists.txt": "material-icon-theme:cmake",
  "build.gradle": "material-icon-theme:gradle",
  "build.gradle.kts": "material-icon-theme:gradle",
  makefile: "material-icon-theme:makefile",
  license: "material-icon-theme:license",
  "license.md": "material-icon-theme:license",
  "license.txt": "material-icon-theme:license",
  "changelog.md": "material-icon-theme:changelog",
  "contributing.md": "material-icon-theme:contributing",
}

const EXTENSIONS: Record<string, string> = {
  ".py": "material-icon-theme:python",
  ".pyi": "material-icon-theme:python",
  ".ipynb": "material-icon-theme:jupyter",
  ".rs": "material-icon-theme:rust",
  ".ts": "material-icon-theme:typescript",
  ".mts": "material-icon-theme:typescript",
  ".cts": "material-icon-theme:typescript",
  ".tsx": "material-icon-theme:react",
  ".jsx": "material-icon-theme:react",
  ".js": "material-icon-theme:javascript",
  ".mjs": "material-icon-theme:javascript",
  ".cjs": "material-icon-theme:javascript",
  ".svelte": "material-icon-theme:svelte",
  ".vue": "material-icon-theme:vue",
  ".go": "material-icon-theme:go",
  ".java": "material-icon-theme:java",
  ".kt": "material-icon-theme:kotlin",
  ".kts": "material-icon-theme:kotlin",
  ".c": "material-icon-theme:c",
  ".h": "material-icon-theme:h",
  ".cpp": "material-icon-theme:cpp",
  ".cc": "material-icon-theme:cpp",
  ".hpp": "material-icon-theme:hpp",
  ".cs": "material-icon-theme:csharp",
  ".rb": "material-icon-theme:ruby",
  ".php": "material-icon-theme:php",
  ".swift": "material-icon-theme:swift",
  ".dart": "material-icon-theme:dart",
  ".lua": "material-icon-theme:lua",
  ".nix": "material-icon-theme:nix",
  ".md": "material-icon-theme:markdown",
  ".mdx": "material-icon-theme:mdx",
  ".toml": "material-icon-theme:toml",
  ".yaml": "material-icon-theme:yaml",
  ".yml": "material-icon-theme:yaml",
  ".html": "material-icon-theme:html",
  ".htm": "material-icon-theme:html",
  ".css": "material-icon-theme:css",
  ".scss": "material-icon-theme:sass",
  ".sass": "material-icon-theme:sass",
  ".json": "material-icon-theme:json",
  ".jsonc": "material-icon-theme:json",
  ".xml": "material-icon-theme:xml",
  ".svg": "material-icon-theme:svg",
  ".sh": "material-icon-theme:console",
  ".bash": "material-icon-theme:console",
  ".zsh": "material-icon-theme:console",
  ".fish": "material-icon-theme:console",
  ".bat": "material-icon-theme:console",
  ".cmd": "material-icon-theme:console",
  ".ps1": "material-icon-theme:powershell",
  ".sql": "material-icon-theme:database",
  ".db": "material-icon-theme:database",
  ".sqlite": "material-icon-theme:database",
  ".csv": "material-icon-theme:table",
  ".tsv": "material-icon-theme:table",
  ".log": "material-icon-theme:log",
  ".lock": "material-icon-theme:lock",
  ".pem": "material-icon-theme:key",
  ".key": "material-icon-theme:key",
  ".ini": "material-icon-theme:settings",
  ".cfg": "material-icon-theme:settings",
  ".conf": "material-icon-theme:settings",
  ".txt": "material-icon-theme:document",
  ".pdf": "material-icon-theme:pdf",
  ".doc": "material-icon-theme:word",
  ".docx": "material-icon-theme:word",
  ".hwp": "material-icon-theme:document",
  ".hwpx": "material-icon-theme:document",
  ".ppt": "material-icon-theme:powerpoint",
  ".pptx": "material-icon-theme:powerpoint",
  ".xls": "material-icon-theme:table",
  ".xlsx": "material-icon-theme:table",
  ".msi": "material-icon-theme:exe",
  ".png": "material-icon-theme:image",
  ".jpg": "material-icon-theme:image",
  ".jpeg": "material-icon-theme:image",
  ".gif": "material-icon-theme:image",
  ".webp": "material-icon-theme:image",
  ".bmp": "material-icon-theme:image",
  ".avif": "material-icon-theme:image",
  ".heic": "material-icon-theme:image",
  ".psd": "material-icon-theme:image",
  ".mp4": "material-icon-theme:video",
  ".mkv": "material-icon-theme:video",
  ".mov": "material-icon-theme:video",
  ".avi": "material-icon-theme:video",
  ".webm": "material-icon-theme:video",
  ".mp3": "material-icon-theme:audio",
  ".wav": "material-icon-theme:audio",
  ".flac": "material-icon-theme:audio",
  ".m4a": "material-icon-theme:audio",
  ".ogg": "material-icon-theme:audio",
  ".zip": "material-icon-theme:zip",
  ".7z": "material-icon-theme:zip",
  ".rar": "material-icon-theme:zip",
  ".tar": "material-icon-theme:zip",
  ".gz": "material-icon-theme:zip",
  ".xz": "material-icon-theme:zip",
  ".ttf": "material-icon-theme:font",
  ".otf": "material-icon-theme:font",
  ".woff": "material-icon-theme:font",
  ".woff2": "material-icon-theme:font",
}

const glyphOf = (name: string) => {
  if (name.startsWith("readme")) {
    return "material-icon-theme:readme"
  }

  if (name.startsWith(".env")) {
    return "material-icon-theme:tune"
  }

  return NAMES[name] ?? EXTENSIONS[extensionOf(name)]
}

export const customIcon = (item: Item) => {
  if (
    item.link ||
    item.drive ||
    item.place ||
    item.key.startsWith("pidl:") ||
    hasOwnIcon(item)
  ) {
    return null
  }

  const name = item.name.toLowerCase()

  if (item.dir) {
    return FOLDERS[name] ?? null
  }

  const glyph = glyphOf(name)

  return glyph && lacksSystemIcon(extensionOf(name)) ? glyph : null
}
