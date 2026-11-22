import interCss from "@fontsource-variable/inter/index.css?raw"
import notoSansJpCss from "@fontsource-variable/noto-sans-jp/index.css?raw"
import notoSansScCss from "@fontsource-variable/noto-sans-sc/index.css?raw"
import vazirmatnCss from "@fontsource-variable/vazirmatn/index.css?raw"
import pretendardCss from "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css?raw"
import type { LocaleTag } from "#lib/i18n/locales.js"

type FontId =
  | "inter"
  | "noto-sans-jp"
  | "noto-sans-sc"
  | "pretendard"
  | "vazirmatn"

type Range = [from: number, to: number]

type Face = { url: string; rule: string; ranges: Range[] }

const LOCALE_FONT: Partial<Record<LocaleTag, FontId>> = {
  fa: "vazirmatn",
  ja: "noto-sans-jp",
  ko: "pretendard",
  "zh-Hans": "noto-sans-sc",
}

const FILES = import.meta.glob<string>(
  [
    "/node_modules/@fontsource-variable/*/files/*-wght-normal.woff2",
    "/node_modules/pretendard/dist/web/variable/woff2-dynamic-subset/*.woff2",
  ],
  { query: "?url", import: "default", eager: true },
)

const urlByName = new Map(
  Object.entries(FILES).map(([path, url]) => [
    path.slice(path.lastIndexOf("/") + 1),
    url,
  ]),
)

const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start) + start.length
  const to = text.indexOf(end, from)

  return text.slice(from, to)
}

const parseRange = (token: string): Range => {
  const [from = "", to = from] = token.trim().slice(2).split("-")

  return [Number.parseInt(from, 16), Number.parseInt(to, 16)]
}

const parseFaces = (css: string): Face[] =>
  css
    .split("@font-face")
    .slice(1)
    .flatMap(chunk => {
      const block = chunk.slice(0, chunk.indexOf("}") + 1)
      const source = between(block, "url(", ")")
      const url = urlByName.get(source.slice(source.lastIndexOf("/") + 1))

      if (!url) {
        return []
      }

      const declarations = block
        .replace(source, url)
        .split("\n")
        .map(line => line.trim())
        .join("")

      return [
        {
          url,
          rule: `@font-face${declarations}`,
          ranges: between(block, "unicode-range:", ";")
            .split(",")
            .map(parseRange),
        },
      ]
    })

const FONTS: Record<FontId, Face[]> = {
  inter: parseFaces(interCss),
  "noto-sans-jp": parseFaces(notoSansJpCss),
  "noto-sans-sc": parseFaces(notoSansScCss),
  pretendard: parseFaces(pretendardCss),
  vazirmatn: parseFaces(vazirmatnCss),
}

const usage = (faces: Face[], text: string) => {
  const counts = new Map<Face, number>()

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    const face = faces.findLast(candidate =>
      candidate.ranges.some(([from, to]) => code >= from && code <= to),
    )

    if (face) {
      counts.set(face, (counts.get(face) ?? 0) + 1)
    }
  }

  return counts
}

export const localeFont = (tag: LocaleTag): FontId =>
  LOCALE_FONT[tag] ?? "inter"

export const fontHead = (
  tag: LocaleTag,
  firstScreenText: string,
  pageText: string,
) => {
  const faces = FONTS[localeFont(tag)]
  const onPage = usage(faces, pageText)

  const preloads = [...usage(faces, firstScreenText)]
    .sort(([, most], [, least]) => least - most)
    .map(
      ([face]) =>
        `<link rel="preload" as="font" type="font/woff2" href="${face.url}" crossorigin>`,
    )

  const rules = faces.filter(face => onPage.has(face)).map(face => face.rule)

  return `${preloads.join("")}<style>${rules.join("")}</style>`
}
