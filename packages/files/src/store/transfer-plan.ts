import { parentOf, pathKey, SEP, sameLocation, WINDOWS } from "../locations"

export type TransferPlan = {
  into: string
  move: boolean
  changed: string[]
}

const sameDrive = (a: string, b: string) =>
  !WINDOWS ||
  (a.slice(0, 2).toLowerCase() === b.slice(0, 2).toLowerCase() && a[1] === ":")

// Keep the drag protocol's raw paths: only equality/parent comparisons normalize.
// In particular UNC transfers copy, even within a share, on Windows.
export const transferPlan = (
  paths: string[],
  location: string,
  filesystem: boolean,
  target: string | null = null,
): TransferPlan | null => {
  const into = target ?? (filesystem ? location : null)

  if (!into || !paths.length) {
    return null
  }

  const inside = (path: string) =>
    sameLocation(path, into) ||
    pathKey(into).startsWith(`${pathKey(path)}${SEP}`)
  const sources = paths.filter(path => !inside(path))
  const move = sources.every(path => sameDrive(path, into))
  const changed = move
    ? sources.filter(path => !sameLocation(parentOf(path) ?? "", into))
    : sources

  return changed.length ? { into, move, changed } : null
}
