import { editors } from "../editor/registry"
import { fillTemplate } from "../markdown/template"
import { loadDevice } from "../settings"
import { isNote, stem } from "../vault/paths"
import { createFile, readFile, saveFile, vault } from "../vault/vault.svelte"
import { openPath } from "./navigate"
import { focusedTab } from "./workspace.svelte"

export const templateFolder = async () =>
  (await loadDevice()).vault.templates.replace(/^\/+|\/+$/g, "")

export const templateFiles = async () => {
  const folder = await templateFolder()

  return vault.entries
    .filter(
      e =>
        !e.folder &&
        isNote(e.path) &&
        folder !== "" &&
        e.path.startsWith(`${folder}/`),
    )
    .map(e => e.path)
}

export const insertTemplate = async (template: string) => {
  const tab = focusedTab()
  const view = tab ? editors.get(tab.id) : undefined

  if (!tab?.path || !view) {
    return
  }

  const text = fillTemplate(await readFile(template), stem(tab.path))
  const { from, to } = view.state.selection.main

  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

export const newFromTemplate = async (template: string, folder: string) => {
  const source = await readFile(template)
  const path = await createFile(folder, "제목 없음", ".md")

  await saveFile(path, fillTemplate(source, stem(path)))
  openPath(path)
}
