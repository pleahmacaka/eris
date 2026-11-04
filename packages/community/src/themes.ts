import type { CommunityTheme } from "./support"

const files = import.meta.glob<CommunityTheme>("../themes/*.json", {
  eager: true,
  import: "default",
})

export const seeds: CommunityTheme[] = Object.values(files)
