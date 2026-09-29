export const NOTE_LINK = "arixlab-note://open?path="

export type Citation = {
  title: string
  path: string
  url: string
}

export type NotesPart = string | Citation

const URL_END = " \t\r\n)"

const PUNCTUATION = ".,;:!?"

const titleOf = (path: string) => {
  const file = path.slice(path.lastIndexOf("/") + 1)

  return file.toLowerCase().endsWith(".md") ? file.slice(0, -3) : file
}

const pathOf = (url: string) => {
  try {
    return new URL(url).searchParams.get("path")
  } catch {
    return null
  }
}

export const splitCitations = (text: string): NotesPart[] => {
  const parts: NotesPart[] = []
  let rest = text
  let at = rest.indexOf(NOTE_LINK)

  while (at >= 0) {
    let end = at

    while (end < rest.length && !URL_END.includes(rest[end])) {
      end += 1
    }

    const bracket = rest.lastIndexOf("[", at)
    const markdown =
      rest.slice(0, at).endsWith("](") && rest[end] === ")" && bracket >= 0

    while (!markdown && end > at && PUNCTUATION.includes(rest[end - 1])) {
      end -= 1
    }

    const url = rest.slice(at, end)
    const path = pathOf(url)
    const start = markdown ? bracket : at
    const stop = markdown ? end + 1 : end

    if (path) {
      parts.push(rest.slice(0, start), {
        title: (markdown && rest.slice(bracket + 1, at - 2)) || titleOf(path),
        path,
        url,
      })
    } else {
      parts.push(rest.slice(0, stop))
    }

    rest = rest.slice(stop)
    at = rest.indexOf(NOTE_LINK)
  }

  parts.push(rest)

  return parts.filter(part => part !== "")
}
