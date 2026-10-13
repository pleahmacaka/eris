import { isAction, type MenuItem } from "@eris/ui"
import { addIcon } from "@iconify/svelte"
import type { Item } from "../items"
import { extensionOf } from "../locations"
import { runShellVerb, type ShellVerb, shellVerbs } from "../native"

const LIFE = 60_000

const FALLBACK_ICON = "lucide:puzzle"

const cache = new Map<string, { at: number; verbs: Promise<ShellVerb[]> }>()

const icons = new Map<string, string>()

export type VerbTarget = { keys: string[]; folder: string | null }

const cacheKey = (selection: Item[]) => {
  if (!selection.length) {
    return "background"
  }

  const kinds = new Set(
    selection.map(item => (item.dir ? "/" : extensionOf(item.name))),
  )

  return `${selection.length > 1 ? "many" : "one"}:${[...kinds].sort().join("|")}`
}

export const targetOf = (selection: Item[], location: string): VerbTarget =>
  selection.length
    ? { keys: selection.map(item => item.key), folder: null }
    : { keys: [], folder: location }

export const loadShellVerbs = (selection: Item[], target: VerbTarget) => {
  const key = cacheKey(selection)
  const hit = cache.get(key)

  if (hit && Date.now() - hit.at < LIFE) {
    return hit.verbs
  }

  const verbs = shellVerbs(target.keys, target.folder)

  cache.set(key, { at: Date.now(), verbs })
  verbs.catch(() => cache.delete(key))

  return verbs
}

const iconOf = (verb: ShellVerb) => {
  if (!verb.icon) {
    return FALLBACK_ICON
  }

  let name = icons.get(verb.icon)

  if (!name) {
    name = `shell-verb:v${icons.size}`
    addIcon(name, {
      body: `<image href="${verb.icon}" width="16" height="16"/>`,
      width: 16,
      height: 16,
    })
    icons.set(verb.icon, name)
  }

  return name
}

const comparable = (label: string) => {
  const text = label.trim().toLowerCase()
  const dots = text.endsWith("...") ? 3 : text.endsWith("…") ? 1 : 0

  return text.slice(0, text.length - dots)
}

export const withShellVerbs = (
  items: MenuItem[],
  verbs: ShellVerb[],
  target: VerbTarget,
  clip: (label: string) => string,
  fail: (reason: unknown) => void,
): MenuItem[] => {
  const own = new Set(
    items.filter(isAction).map(entry => comparable(entry.label)),
  )
  const extra = verbs
    .filter(verb => !own.has(comparable(verb.label)))
    .map(verb => ({
      label: clip(verb.label),
      icon: iconOf(verb),
      action: () =>
        runShellVerb(target.keys, target.folder, verb.verb, verb.label).catch(
          fail,
        ),
    }))

  if (!extra.length) {
    return items
  }

  const last = items.length - 1

  return [...items.slice(0, last), "separator", ...extra, ...items.slice(last)]
}
