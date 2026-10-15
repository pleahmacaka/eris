import { SvelteMap } from "svelte/reactivity"
import { genericIcons } from "../native"

const known = new SvelteMap<string, boolean>()
const asked = new Set<string>()
let queue: string[] = []

const resolve = async () => {
  const batch = queue

  queue = []

  const generic = new Set(await genericIcons(batch).catch(() => []))

  for (const extension of batch) {
    known.set(extension, generic.has(extension))
  }
}

export const lacksSystemIcon = (extension: string) => {
  if (!asked.has(extension)) {
    asked.add(extension)

    if (!queue.length) {
      queueMicrotask(resolve)
    }

    queue.push(extension)
  }

  return known.get(extension) === true
}
