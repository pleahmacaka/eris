import { DEFAULT_LOCALE, type LocaleTag } from "#lib/i18n/locales.js"
import en from "./messages/en.json"

export type Messages = typeof en

export type MessageKey = keyof Messages

export type Catalog = Partial<Messages>

type CatalogLoader = () => Promise<{ default: Catalog }>

const loaders: Record<
  Exclude<LocaleTag, typeof DEFAULT_LOCALE>,
  CatalogLoader
> = {
  de: () => import("./messages/de.json"),
  fr: () => import("./messages/fr.json"),
  ru: () => import("./messages/ru.json"),
  fa: () => import("./messages/fa.json"),
  vi: () => import("./messages/vi.json"),
  "sr-Cyrl": () => import("./messages/sr-Cyrl.json"),
  "sr-Latn": () => import("./messages/sr-Latn.json"),
  uk: () => import("./messages/uk.json"),
  es: () => import("./messages/es.json"),
  "pt-BR": () => import("./messages/pt-BR.json"),
  "zh-Hans": () => import("./messages/zh-Hans.json"),
  ja: () => import("./messages/ja.json"),
  ko: () => import("./messages/ko.json"),
  nl: () => import("./messages/nl.json"),
  cs: () => import("./messages/cs.json"),
  it: () => import("./messages/it.json"),
  fi: () => import("./messages/fi.json"),
}

export const sourceCatalog: Messages = en

export const loadCatalog = async (tag: LocaleTag): Promise<Catalog> =>
  tag === DEFAULT_LOCALE ? en : (await loaders[tag]()).default
