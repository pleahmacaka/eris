import { webAccount } from "@eris/auth"
import type { CommunityTheme } from "./support"
import { seeds } from "./themes"

export type Draft = Pick<
  CommunityTheme,
  "slug" | "author" | "name" | "description" | "swatch" | "appearance" | "tags"
>

const COLUMNS =
  "id, slug, owner, author, name, description, swatch, appearance, tags, likes, downloads, created_at"

const LIMIT = 500

const themes = () => webAccount().client.from("themes")

const fail = (error: { message: string } | null) => {
  if (error) {
    throw new Error(
      error.message.includes("rate_limited") ? "rate_limited" : error.message,
    )
  }
}

export const loadThemes = async (): Promise<{
  themes: CommunityTheme[]
  live: boolean
}> => {
  const { data, error } = await themes()
    .select(COLUMNS)
    .limit(LIMIT)
    .overrideTypes<CommunityTheme[], { merge: false }>()

  return error || !data
    ? { themes: seeds, live: false }
    : { themes: data, live: true }
}

export const loadLiked = async () => {
  const { data } = await webAccount()
    .client.from("theme_likes")
    .select("theme")
    .overrideTypes<{ theme: string }[], { merge: false }>()

  return new Set((data ?? []).map(row => row.theme))
}

export const setLiked = async (theme: string, liked: boolean) => {
  const likes = webAccount().client.from("theme_likes")
  const { error } = liked
    ? await likes.insert({ theme })
    : await likes.delete().eq("theme", theme)

  fail(error)
}

export const countDownload = async (theme: string) => {
  const { data } = await webAccount().client.rpc("count_download", {
    target: theme,
  })

  return typeof data === "number" ? data : null
}

export const publish = async (draft: Draft, id?: string) => {
  const written = id
    ? themes().update(draft).eq("id", id)
    : themes().insert(draft)
  const { data, error } = await written
    .select(COLUMNS)
    .single()
    .overrideTypes<CommunityTheme, { merge: false }>()

  fail(error)

  if (!data) {
    throw new Error("failed")
  }

  return data
}

export const remove = async (id: string) => {
  const { error } = await themes().delete().eq("id", id)

  fail(error)
}
