import { basename, dirname, isNote, stem } from "./paths"

export type WikiLink = {
  target: string
  heading: string | null
  alias: string | null
  from: number
  to: number
}

const WIKILINK = /!?\[\[([^[\]|#]+)(#[^[\]|]*)?(\|[^[\]]*)?\]\]/g

export const parseLinks = (text: string): WikiLink[] =>
  [...text.matchAll(WIKILINK)].map(m => ({
    target: m[1].trim(),
    heading: m[2]?.slice(1) || null,
    alias: m[3]?.slice(1) || null,
    from: m.index,
    to: m.index + m[0].length,
  }))

const withoutNoteExtension = (path: string) =>
  isNote(path) ? path.slice(0, path.lastIndexOf(".")) : path

export const resolveLink = (
  target: string,
  from: string,
  paths: readonly string[],
): string | null => {
  const wanted = target.toLocaleLowerCase()
  const bare = !wanted.includes("/")

  const candidates = paths.filter(path => {
    const key = (bare ? basename(path) : path).toLocaleLowerCase()

    return key === wanted || withoutNoteExtension(key) === wanted
  })

  if (candidates.length <= 1) {
    return candidates[0] ?? null
  }

  const here = dirname(from)

  return (
    candidates.find(path => dirname(path) === here) ??
    candidates.sort((a, b) => a.length - b.length)[0]
  )
}

export const linkText = (path: string, paths: readonly string[]) => {
  const name = stem(path)
  const unique =
    paths.filter(p => stem(p).toLocaleLowerCase() === name.toLocaleLowerCase())
      .length === 1

  return unique ? name : withoutNoteExtension(path)
}

export const outgoing = (
  path: string,
  text: string,
  paths: readonly string[],
) =>
  parseLinks(text)
    .map(link => resolveLink(link.target, path, paths))
    .filter((p): p is string => p !== null)

export const backlinks = (
  target: string,
  texts: ReadonlyMap<string, string>,
  paths: readonly string[],
) => {
  const found: { path: string; line: string }[] = []

  for (const [path, text] of texts) {
    if (path === target) {
      continue
    }

    for (const link of parseLinks(text)) {
      if (resolveLink(link.target, path, paths) === target) {
        const start = text.lastIndexOf("\n", link.from) + 1
        const end = text.indexOf("\n", link.to)

        found.push({
          path,
          line: text.slice(start, end === -1 ? undefined : end).trim(),
        })
      }
    }
  }

  return found
}
