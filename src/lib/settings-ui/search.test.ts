import { expect, test } from "bun:test"
import { index, searchRows, searchSections, sections } from "./search"

test("empty query keeps every section and finds no row", () => {
  expect(searchSections("  ")).toEqual(sections)
  expect(searchRows("")).toEqual([])
})

test("keywords match rows their label does not name", () => {
  expect(searchRows("autostart").map(e => e.label)).toEqual([
    "Start with Windows",
  ])
  expect(searchSections("autostart").map(s => s.id)).toEqual(["general"])
})

test("a label match narrows the nav to its section", () => {
  expect(searchSections("Token").map(s => s.id)).toEqual(["sync"])
  expect(searchSections("nothing here at all")).toEqual([])
})

test("every entry points at a real section", () => {
  const ids = new Set(sections.map(s => s.id))

  expect(index.filter(e => !ids.has(e.section))).toEqual([])
})
