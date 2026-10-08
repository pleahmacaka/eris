import "@fontsource-variable/jetbrains-mono"
import nerdSymbols from "@azurity/pure-nerd-font/PureNerdFont.woff2?url"
import pretendard from "pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url"

export const DEFAULT_FONT = "JetBrains Mono Variable"

const FALLBACKS = [
  { family: "Pure Nerd Font", url: nerdSymbols, weight: "normal" },
  { family: "Pretendard", url: pretendard, weight: "45 920" },
]

let engine: Promise<void> | null = null
let fallbacks: Promise<unknown> | null = null

const register = () =>
  Promise.all(
    FALLBACKS.map(async ({ family, url, weight }) => {
      const face = new FontFace(family, `url(${url})`, { weight })

      document.fonts.add(await face.load())
    }),
  )

const quoted = (family: string) =>
  family.includes(" ") && !family.includes('"') && !family.includes(",")
    ? `"${family}"`
    : family

export const fontStack = (family: string) =>
  [
    quoted(family.trim() || DEFAULT_FONT),
    ...FALLBACKS.map(f => `"${f.family}"`),
  ].join(", ")

const loadFaces = (family: string) =>
  Promise.all(
    [...document.fonts]
      .filter(face => face.family.replaceAll('"', "") === family)
      .map(face => face.load().catch(() => face)),
  )

export const loadFont = async (family: string, size: number) => {
  fallbacks ??= register()

  await Promise.all([fallbacks, loadFaces(family.trim())])
  await document.fonts.load(`${size}px ${fontStack(family)}`).catch(() => [])
}

export const prepare = (family: string, size: number) => {
  engine ??= import("ghostty-web").then(ghostty => ghostty.init())

  return Promise.all([engine, loadFont(family, size)])
}
