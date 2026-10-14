import { addIcon } from "@iconify/svelte"

const names = new Map<string, string>()

const sources = new Map<string, string>()

export const imageIcon = (source: string) => {
  let name = names.get(source)

  if (!name) {
    name = `eris-image:i${names.size}`
    addIcon(name, {
      body: `<image href="${source}" width="16" height="16"/>`,
      width: 16,
      height: 16,
    })
    names.set(source, name)
    sources.set(name, source)
  }

  return name
}

export const imageOf = (icon: string) => sources.get(icon) ?? null
