export type Heading = { level: number; text: string; line: number }

export const outline = (text: string): Heading[] => {
  const headings: Heading[] = []
  let fenced = false

  text.split("\n").forEach((raw, index) => {
    const line = raw.trimStart()

    if (line.startsWith("```") || line.startsWith("~~~")) {
      fenced = !fenced

      return
    }

    const match = fenced ? null : /^(#{1,6})\s+(.+?)\s*#*$/.exec(line)

    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2],
        line: index + 1,
      })
    }
  })

  return headings
}
