import { noteTitle } from "../data/notes"
import { notes, syncMeta, updateSyncMeta } from "../data/store"
import { createFile, vault } from "./vault.svelte"

const FOLDER = "메모"

export const legacyImported = async () =>
  (await syncMeta()).importedInto.includes(vault.root)

export const importLegacyNotes = async () => {
  let count = 0

  for (const note of await notes.all()) {
    await createFile(FOLDER, noteTitle(note), ".md", note.body)
    count++
  }

  const meta = await syncMeta()

  await updateSyncMeta({ importedInto: [...meta.importedInto, vault.root] })

  return count
}
