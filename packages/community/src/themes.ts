import type { CommunityTheme } from "./support"

const files = import.meta.glob<CommunityTheme>("../themes/*.json", {
  eager: true,
  import: "default",
})

export const themes = Object.values(files).sort((a, b) =>
  a.name.localeCompare(b.name),
)
