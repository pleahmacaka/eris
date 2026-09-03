import { expect, test } from "bun:test"
import { notePreview, noteTitle, searchNotes, sortNotes } from "./notes"
import type { Note } from "./types"

const note = (over: Partial<Note> = {}): Note => ({
  id: "n",
  title: "",
  body: "",
  pinned: false,
  color: null,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

test("pinned notes come first, then the most recently edited", () => {
  const items = [
    note({ id: "old", updatedAt: 1 }),
    note({ id: "fresh", updatedAt: 3 }),
    note({ id: "pinned", updatedAt: 2, pinned: true }),
  ]

  expect(sortNotes(items).map(n => n.id)).toEqual(["pinned", "fresh", "old"])
})

test("search matches title and body regardless of case", () => {
  const items = [
    note({ id: "a", title: "Groceries" }),
    note({ id: "b", body: "buy MILK" }),
    note({ id: "c", title: "Meeting" }),
  ]

  expect(searchNotes(items, "  milk ").map(n => n.id)).toEqual(["b"])
  expect(searchNotes(items, "  ")).toHaveLength(3)
})

test("an untitled note falls back to its first body line", () => {
  expect(noteTitle(note({ body: "  first line \nsecond" }))).toBe("first line")
  expect(noteTitle(note())).toBe("Untitled")
  expect(notePreview(note({ body: "one\n\n  two  " }))).toBe("one two")
})
