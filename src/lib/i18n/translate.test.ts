import { describe, expect, test } from "bun:test"
import {
  isPluralElement,
  isSelectElement,
  isTagElement,
  type MessageFormatElement,
  parse,
} from "@formatjs/icu-messageformat-parser"
import IntlMessageFormat from "intl-messageformat"
import { loadCatalog, type MessageKey, sourceCatalog } from "./catalogs"
import { LOCALES, type LocaleTag } from "./locales"
import { createTranslator } from "./translate"

const files = "{count, plural, one {# file} other {# files}}"

const plural = (locale: LocaleTag, message: string, counts: number[]) => {
  const format = new IntlMessageFormat(message, locale)
  return counts.map(count => format.format({ count }))
}

describe("CLDR plurals", () => {
  test("Russian and Ukrainian pick one, few, many and other", () => {
    const ru =
      "{count, plural, one {# файл} few {# файла} many {# файлов} other {# файла}}"
    const uk =
      "{count, plural, one {# файл} few {# файли} many {# файлів} other {# файлу}}"

    expect(plural("ru", ru, [1, 2, 5, 21, 1.5])).toEqual([
      "1 файл",
      "2 файла",
      "5 файлов",
      "21 файл",
      "1,5 файла",
    ])
    expect(plural("uk", uk, [1, 2, 5, 21, 1.5])).toEqual([
      "1 файл",
      "2 файли",
      "5 файлів",
      "21 файл",
      "1,5 файлу",
    ])
  })

  test("Czech uses many for fractions", () => {
    const cs =
      "{count, plural, one {# soubor} few {# soubory} many {# souboru} other {# souborů}}"

    expect(plural("cs", cs, [1, 2, 5, 21, 1.5])).toEqual([
      "1 soubor",
      "2 soubory",
      "5 souborů",
      "21 souborů",
      "1,5 souboru",
    ])
  })

  test("both Serbian scripts share one, few and other", () => {
    const cyrl =
      "{count, plural, one {# датотека} few {# датотеке} other {# датотека}}"
    const latn =
      "{count, plural, one {# datoteka} few {# datoteke} other {# datoteka}}"

    expect(plural("sr-Cyrl", cyrl, [1, 2, 5, 21])).toEqual([
      "1 датотека",
      "2 датотеке",
      "5 датотека",
      "21 датотека",
    ])
    expect(plural("sr-Latn", latn, [1, 2, 5, 21])).toEqual([
      "1 datoteka",
      "2 datoteke",
      "5 datoteka",
      "21 datoteka",
    ])
  })

  test("Persian renders the count in Persian digits", () => {
    expect(
      plural("fa", "{count, plural, one {# فایل} other {# فایل}}", [12]),
    ).toEqual(["۱۲ فایل"])
    expect(plural("en", files, [1, 2])).toEqual(["1 file", "2 files"])
  })
})

describe("createTranslator", () => {
  test("fills variables into one whole message", () => {
    const ko = createTranslator("ko", {
      "settings.language.system": "시스템 ({language})",
    })
    expect(ko("settings.language.system", { language: "English" })).toBe(
      "시스템 (English)",
    )
  })

  test("falls back to the English source for missing keys", () => {
    const partial = createTranslator("de", {})
    expect(partial("settings.language.title")).toBe(
      sourceCatalog["settings.language.title"],
    )
  })
})

const pluralOptionSets = (elements: MessageFormatElement[]): string[][] =>
  elements.flatMap(element => {
    if (isPluralElement(element) || isSelectElement(element)) {
      const own =
        isPluralElement(element) && element.pluralType === "cardinal"
          ? [Object.keys(element.options)]
          : []
      return [
        ...own,
        ...Object.values(element.options).flatMap(option =>
          pluralOptionSets(option.value),
        ),
      ]
    }
    return isTagElement(element) ? pluralOptionSets(element.children) : []
  })

describe("catalogs", () => {
  const sourceKeys = Object.keys(sourceCatalog).sort()

  for (const { tag } of LOCALES) {
    test(`${tag} has every key, valid ICU and its CLDR plural categories`, async () => {
      const catalog = await loadCatalog(tag)
      expect(Object.keys(catalog).sort()).toEqual(sourceKeys)

      const categories = new Intl.PluralRules(tag).resolvedOptions()
        .pluralCategories as string[]

      for (const key of sourceKeys as MessageKey[]) {
        const message = catalog[key] ?? ""
        for (const options of pluralOptionSets(parse(message))) {
          const named = options.filter(option => !option.startsWith("="))
          expect(named.sort()).toEqual([...categories].sort())
        }
      }
    })
  }
})
