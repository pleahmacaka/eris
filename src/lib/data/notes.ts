import type { Note } from "./types"

export const blankNote = (): Note => {
  const stamp = Date.now()

  return {
    id: crypto.randomUUID(),
    title: "",
    body: "",
    pinned: false,
    color: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

export const sortNotes = (items: Note[]) =>
  [...items].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt,
  )

export const searchNotes = (items: Note[], query: string) => {
  const needle = query.trim().toLowerCase()

  if (needle === "") {
    return items
  }

  return items.filter(note =>
    `${note.title}\n${note.body}`.toLowerCase().includes(needle),
  )
}

export const noteTitle = (note: Note) => {
  const [first = ""] = note.body.split("\n")

  return note.title.trim() || first.trim() || "Untitled"
}

export const notePreview = (note: Note) =>
  note.body
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .join(" ")
