import { extensionOf } from "./locations"

export type FileKind = "image" | "video" | "audio" | "pdf" | "text" | "model"

const KINDS: Record<FileKind, string[]> = {
  image: [
    ".png",
    ".jpg",
    ".jpeg",
    ".jfif",
    ".gif",
    ".bmp",
    ".webp",
    ".avif",
    ".svg",
    ".ico",
  ],
  video: [".mp4", ".webm", ".mov", ".m4v", ".ogv"],
  audio: [
    ".wav",
    ".mp3",
    ".m4a",
    ".aac",
    ".ogg",
    ".oga",
    ".opus",
    ".flac",
    ".weba",
  ],
  pdf: [".pdf"],
  model: [".obj"],
  text: [
    ".txt",
    ".md",
    ".markdown",
    ".log",
    ".csv",
    ".tsv",
    ".json",
    ".jsonc",
    ".xml",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".env",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
    ".svelte",
    ".vue",
    ".html",
    ".htm",
    ".css",
    ".scss",
    ".rs",
    ".py",
    ".go",
    ".java",
    ".kt",
    ".c",
    ".h",
    ".cpp",
    ".hpp",
    ".cs",
    ".sh",
    ".ps1",
    ".bat",
    ".cmd",
    ".sql",
    ".lua",
    ".rb",
    ".php",
    ".swift",
    ".srt",
    ".mtl",
  ],
}

const ORDER = Object.keys(KINDS) as FileKind[]

export const kindOf = (name: string): FileKind | null => {
  const extension = extensionOf(name)

  return ORDER.find(kind => KINDS[kind].includes(extension)) ?? null
}

export const isAudio = (name: string) => kindOf(name) === "audio"
