import type { Appearance } from "@eris/settings"

export type Tool = "eris" | "files" | "terminal"

export type CommunityTheme = {
  id: string
  name: string
  author: string
  description: string
  swatch: [string, string, string]
  appearance: Partial<Appearance>
}

export const TOOLS: Tool[] = ["eris", "files", "terminal"]

const dockOnly = (key: string) => key.startsWith("dock")

// Files and Terminal follow the Eris look for every key except the dock ones, which only the dock reads
export const toolsOf = (theme: CommunityTheme): Tool[] => {
  const keys = Object.keys(theme.appearance)

  if (!keys.length) {
    return []
  }

  return keys.every(dockOnly) ? ["eris"] : TOOLS
}

export const previewUrl = (
  studio: string,
  path: string,
  theme: CommunityTheme,
) => {
  const url = new URL(path, studio)

  url.searchParams.set("appearance", JSON.stringify(theme.appearance))

  return url.href
}
