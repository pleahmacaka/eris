import { type Copy, en } from "./en"
import { ko } from "./ko"

export type Lang = "en" | "ko"

export const copy: Record<Lang, Copy> = { en, ko }

export const languages: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "한국어" },
]

export const hrefFor = (from: Lang, to: Lang) => {
  const root = from === "en" ? "./" : "../"

  return to === "en" ? root : `${root}${to}/`
}
