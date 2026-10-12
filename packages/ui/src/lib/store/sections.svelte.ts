import { SvelteSet } from "svelte/reactivity"

const KEY = "eris-collapsed-sections"

const stored = (): string[] => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]")

    return Array.isArray(value) ? value.map(String) : []
  } catch {
    return []
  }
}

export const collapsed = new SvelteSet<string>(stored())

const save = () => {
  localStorage.setItem(KEY, JSON.stringify([...collapsed]))
}

export const toggleSection = (id: string) => {
  if (!collapsed.delete(id)) {
    collapsed.add(id)
  }

  save()
}

export const revealSection = (id: string) => {
  if (collapsed.delete(id)) {
    save()
  }
}
