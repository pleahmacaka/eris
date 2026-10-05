import { resolveLink } from "../vault/links"
import { isCanvas } from "../vault/paths"
import { createFile, vault } from "../vault/vault.svelte"
import { type OpenOptions, openView } from "./workspace.svelte"

export const filePaths = () =>
  vault.entries.filter(e => !e.folder).map(e => e.path)

export const openPath = (path: string, options: OpenOptions = {}) =>
  openView(isCanvas(path) ? "canvas" : "note", path, options)

export const openLink = async (
  target: string,
  from: string,
  newTab = false,
) => {
  const resolved = resolveLink(target, from, filePaths())

  openPath(resolved ?? (await createFile("", target, ".md")), { newTab })
}
