import type { LocaleTag } from "./locales"

const fontLoaders: Partial<Record<LocaleTag, () => Promise<unknown>>> = {
  ja: () => import("@fontsource-variable/noto-sans-jp/index.css"),
  "zh-Hans": () => import("@fontsource-variable/noto-sans-sc/index.css"),
  fa: () => import("@fontsource-variable/vazirmatn/index.css"),
}

export const loadLocaleFonts = async (tag: LocaleTag) => {
  await fontLoaders[tag]?.()
}
