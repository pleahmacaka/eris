import {
  type Appearance,
  type DeviceSettings,
  WINDOW_BACKGROUNDS,
} from "@eris/settings"

export type Tool = "eris" | "files" | "terminal"

export type Mode = "dark" | "light"

export type Sort = "popular" | "downloads" | "likes" | "newest" | "name"

export type CommunityTheme = {
  id: string
  slug: string
  owner: string | null
  author: string
  name: string
  description: string
  swatch: [string, string, string]
  appearance: Partial<Appearance>
  tags: string[]
  likes: number
  downloads: number
  created_at: string
}

export type Browse = {
  q: string
  sort: Sort
  tool: Tool | ""
  mode: Mode | ""
  tag: string
}

export const TOOLS: Tool[] = ["eris", "files", "terminal"]

export const SORTS: Sort[] = ["popular", "downloads", "likes", "newest", "name"]

export const MODES: Mode[] = ["dark", "light"]

const OWNED: Record<string, Tool> = Object.fromEntries(
  Object.entries(WINDOW_BACKGROUNDS).map(([surface, key]) => [
    key,
    surface === "files" || surface === "terminal" ? surface : "eris",
  ]),
)

// Files and Terminal follow the Eris look for every shared key; dock and per-window keys reach only their own app
const toolsFor = (key: string): Tool[] =>
  key.startsWith("dock") ? ["eris"] : OWNED[key] ? [OWNED[key]] : TOOLS

export const toolsOf = (theme: Pick<CommunityTheme, "appearance">): Tool[] => {
  const reached = new Set(Object.keys(theme.appearance).flatMap(toolsFor))

  return TOOLS.filter(tool => reached.has(tool))
}

const fitsMode = (theme: CommunityTheme, mode: Mode | "") =>
  !mode ||
  !theme.appearance.mode ||
  theme.appearance.mode === "system" ||
  theme.appearance.mode === mode

const matches = (theme: CommunityTheme, needle: string) =>
  !needle ||
  [theme.name, theme.author, theme.description, ...theme.tags].some(text =>
    text.toLowerCase().includes(needle),
  )

const ORDER: Record<Sort, (a: CommunityTheme, b: CommunityTheme) => number> = {
  popular: (a, b) => b.likes * 3 + b.downloads - (a.likes * 3 + a.downloads),
  downloads: (a, b) => b.downloads - a.downloads,
  likes: (a, b) => b.likes - a.likes,
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  name: (a, b) => a.name.localeCompare(b.name),
}

// ponytail: filters run over the whole list in the page; move to a server query when the catalog outgrows one fetch
export const browse = (themes: CommunityTheme[], query: Browse) => {
  const needle = query.q.trim().toLowerCase()

  return themes
    .filter(
      theme =>
        matches(theme, needle) &&
        fitsMode(theme, query.mode) &&
        (!query.tool || toolsOf(theme).includes(query.tool)) &&
        (!query.tag || theme.tags.includes(query.tag)),
    )
    .sort((a, b) => ORDER[query.sort](a, b) || a.name.localeCompare(b.name))
}

export const tagsOf = (themes: CommunityTheme[]) =>
  [...new Set(themes.flatMap(theme => theme.tags))].sort()

export const previewUrl = (
  studio: string,
  path: string,
  appearance: Partial<Appearance>,
  device?: Partial<DeviceSettings>,
) => {
  const url = new URL(path, new URL(studio, location.href))

  url.searchParams.set("appearance", JSON.stringify(appearance))

  if (device) {
    url.searchParams.set("device", JSON.stringify(device))
  }

  return url.href
}

export const applyLink = (theme: Pick<CommunityTheme, "name" | "appearance">) =>
  `eris://theme?${new URLSearchParams({
    name: theme.name,
    appearance: JSON.stringify(theme.appearance),
  })}`

export const slugify = (name: string) => {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .split("")
    .filter(
      c =>
        (c >= "a" && c <= "z") ||
        (c >= "0" && c <= "9") ||
        c === " " ||
        c === "-",
    )
    .join("")
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .join("-")
    .slice(0, 36)

  return `${base || "theme"}-${crypto.randomUUID().slice(0, 6)}`
}
