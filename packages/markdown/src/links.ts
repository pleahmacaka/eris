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
