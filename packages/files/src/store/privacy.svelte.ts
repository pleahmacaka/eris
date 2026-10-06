import { normalize, pathKey, SEP } from "../locations"
import { screenSharing } from "../native"
import { prefs } from "./prefs.svelte"

const key = (path: string) => pathKey(normalize(path))

const covers = (mark: string, path: string) => {
  const root = key(mark)
  const target = key(path)

  return (
    target === root ||
    target.startsWith(root.endsWith(SEP) ? root : `${root}${SEP}`)
  )
}

export const isMarked = (path: string) =>
  prefs.privatePaths.some(mark => key(mark) === key(path))

export const toggleMark = (path: string) => {
  prefs.privatePaths = isMarked(path)
    ? prefs.privatePaths.filter(mark => key(mark) !== key(path))
    : [...prefs.privatePaths, normalize(path)]
}

export const pending = $state<{ path: string | null }>({ path: null })

let settle: ((open: boolean) => void) | null = null

let granted: string | null = null

export const answer = (open: boolean) => {
  granted = open ? pending.path : null
  settle?.(open)
  settle = null
  pending.path = null
}

export const confirmAll = async (paths: string[], from = "") => {
  for (const path of paths) {
    if (!(await confirmPrivate(path, from))) {
      return false
    }
  }

  return true
}

export const confirmPrivate = async (path: string, from = "") => {
  const marks = prefs.privatePaths.filter(mark => covers(mark, path))

  if (marks.every(mark => from && covers(mark, from))) {
    return true
  }

  if (granted !== null && key(granted) === key(path)) {
    granted = null

    return true
  }

  if (!(await screenSharing().catch(() => true))) {
    return true
  }

  answer(false)

  return new Promise<boolean>(resolve => {
    settle = resolve
    pending.path = path
  })
}
