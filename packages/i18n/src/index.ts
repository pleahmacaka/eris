import { get } from "svelte/store"
import { addMessages, init, locale, register, t } from "svelte-i18n"
import en from "./en.json"

export type Language = "system" | "en" | "ko" | "ja" | "zh"

export type Locale = Exclude<Language, "system">

export const LANGUAGES: Language[] = ["system", "en", "ko", "ja", "zh"]

const LOADERS = {
  ko: () => import("./ko.json"),
  ja: () => import("./ja.json"),
  zh: () => import("./zh.json"),
}

let started = false

const detect = (): Locale => {
  const tag =
    typeof navigator === "undefined" ? "en" : navigator.language.toLowerCase()

  if (tag.startsWith("ko")) {
    return "ko"
  }

  if (tag.startsWith("ja")) {
    return "ja"
  }

  if (tag.startsWith("zh")) {
    return "zh"
  }

  return "en"
}

export const resolveLanguage = (language: Language): Locale =>
  language === "system" ? detect() : language

const lookup = (key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    )

const fill = (text: string, values?: Record<string, string | number>) => {
  let out = text

  for (const [name, value] of Object.entries(values ?? {})) {
    out = out.replaceAll(`{${name}}`, String(value))
  }

  return out
}

export const tr = (key: string, values?: Record<string, string | number>) => {
  if (!started) {
    const raw = lookup(key)

    return typeof raw === "string" ? fill(raw, values) : key
  }

  return get(t)(key, { values })
}

export const currentLocale = (): string =>
  started ? (get(locale) ?? "en") : "en"

// a locale still loading leaves svelte-i18n without one and every lookup throws, so English stays current until it lands
export const setupI18n = async (language: Language) => {
  if (!started) {
    addMessages("en", en)

    for (const [name, loader] of Object.entries(LOADERS)) {
      register(name, loader)
    }

    init({ fallbackLocale: "en", initialLocale: "en" })
    started = true
  }

  await locale.set(resolveLanguage(language))
}
