import { expect, test } from "bun:test"
import en from "../i18n/en.json"
import { index, searchRows, searchSections, sections } from "./search"

const t = (key: string) =>
  key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en) as string

test("empty query keeps every section and finds no row", () => {
  expect(searchSections("  ", t)).toEqual(sections)
  expect(searchRows("", t)).toEqual([])
})

test("keywords match rows their label does not name", () => {
  expect(searchRows("autostart", t).map(e => e.key)).toEqual([
    "settings.rows.autostart",
  ])
  expect(searchSections("autostart", t).map(s => s.id)).toEqual(["general"])
})

test("a label match narrows the nav to its section", () => {
  expect(searchSections("Token", t).map(s => s.id)).toEqual(["sync"])
  expect(searchSections("nothing here at all", t)).toEqual([])
})

test("every entry points at a real section", () => {
  const ids = new Set(sections.map(s => s.id))

  expect(index.filter(e => !ids.has(e.section))).toEqual([])
})
