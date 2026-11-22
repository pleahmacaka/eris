import IntlMessageFormat from "intl-messageformat"
import { type Catalog, type MessageKey, sourceCatalog } from "./catalogs"
import { DEFAULT_LOCALE, type LocaleTag } from "./locales"

export type MessageValues = Record<string, string | number | Date>
export type Message = { key: MessageKey; values?: MessageValues }
export type Translate = (key: MessageKey, values?: MessageValues) => string

export const createTranslator = (
  locale: LocaleTag,
  catalog: Catalog,
): Translate => {
  const compiled = new Map<MessageKey, IntlMessageFormat>()

  const compile = (key: MessageKey) => {
    const own = catalog[key]
    const format =
      own === undefined
        ? new IntlMessageFormat(sourceCatalog[key], DEFAULT_LOCALE)
        : new IntlMessageFormat(own, locale)
    compiled.set(key, format)
    return format
  }

  return (key, values) =>
    String((compiled.get(key) ?? compile(key)).format<string>(values))
}
