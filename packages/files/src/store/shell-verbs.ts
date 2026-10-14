import type { MenuAction } from "@eris/ui"
import { imageIcon } from "../image-icon"
import type { Item } from "../items"
import { extensionOf } from "../locations"
import { runShellVerb, type ShellVerb, shellVerbs } from "../native"
import { prefs, type RememberedVerb } from "./prefs.svelte"

const LIFE = 60_000

const FALLBACK_ICON = "lucide:puzzle"

const cache = new Map<string, { at: number; verbs: Promise<ShellVerb[]> }>()

const REMEMBERED = 60

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

export const verbIcon = (icon: string | null) =>
  icon ? imageIcon(icon) : FALLBACK_ICON

const comparable = (label: string) => {
  const text = label.trim().toLowerCase()
  const dots = text.endsWith("...") ? 3 : text.endsWith("…") ? 1 : 0

  return text.slice(0, text.length - dots)
}

const verbId = (verb: ShellVerb) =>
  `shell:${verb.verb || comparable(verb.label)}`

export const rememberVerbs = (verbs: ShellVerb[]) => {
  const known = new Set(prefs.shellVerbs.map(verb => verb.id))
  const fresh: RememberedVerb[] = []

  for (const verb of verbs) {
    const id = verbId(verb)

    if (!known.has(id) && prefs.shellVerbs.length + fresh.length < REMEMBERED) {
      known.add(id)
      fresh.push({ id, label: verb.label, icon: verb.icon })
    }
  }

  if (fresh.length > 0) {
    prefs.shellVerbs = [...prefs.shellVerbs, ...fresh]
    prefs.menuItems.shell.order = [
      ...prefs.menuItems.shell.order,
      ...fresh.map(verb => verb.id),
    ]
  }
}

export const shellItems = (
  own: MenuAction[],
  verbs: ShellVerb[],
  target: VerbTarget,
  clip: (label: string) => string,
  fail: (reason: unknown) => void,
): MenuAction[] => {
  const taken = new Set(own.map(entry => comparable(entry.label)))

  return verbs
    .filter(verb => !taken.has(comparable(verb.label)))
    .map(verb => ({
      id: verbId(verb),
      label: clip(verb.label),
      icon: verbIcon(verb.icon),
      action: () =>
        runShellVerb(target.keys, target.folder, verb.verb, verb.label).catch(
          fail,
        ),
    }))
}
