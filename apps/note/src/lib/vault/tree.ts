import type { Entry } from "./disk"
import { basename, dirname } from "./paths"

export type TreeNode = {
  path: string
  name: string
  folder: boolean
  children: TreeNode[]
}

const byKindThenName = (a: TreeNode, b: TreeNode) =>
  Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name, "ko")

export const buildTree = (entries: readonly Entry[]) => {
  const root: TreeNode = { path: "", name: "", folder: true, children: [] }
  const folders = new Map<string, TreeNode>([["", root]])

  const folderNode = (path: string): TreeNode => {
    const known = folders.get(path)

    if (known) {
      return known
    }

    const node: TreeNode = {
      path,
      name: basename(path),
      folder: true,
      children: [],
    }

    folders.set(path, node)
    folderNode(dirname(path)).children.push(node)

    return node
  }

  for (const entry of entries) {
    if (entry.folder) {
      folderNode(entry.path)
    } else {
      folderNode(dirname(entry.path)).children.push({
        path: entry.path,
        name: basename(entry.path),
        folder: false,
        children: [],
      })
    }
  }

  for (const node of folders.values()) {
    node.children.sort(byKindThenName)
  }

  return root.children
}
