import type { CommunityTheme } from "./support"

type Seed = Pick<
  CommunityTheme,
  "id" | "name" | "author" | "description" | "swatch" | "appearance" | "tags"
>

const files = import.meta.glob<Seed>("../themes/*.json", {
  eager: true,
  import: "default",
})

export const seeds: CommunityTheme[] = Object.values(files).map(seed => ({
  ...seed,
  slug: seed.id,
  owner: null,
  likes: 0,
  downloads: 0,
  created_at: "",
}))
