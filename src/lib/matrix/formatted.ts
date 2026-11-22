export type FormattedNode =
  | { type: "text"; text: string }
  | {
      type: "element"
      tag: string
      href: string | null
      children: FormattedNode[]
    }

type Frame = { tag: string | null; href: string | null; nodes: FormattedNode[] }

const KEPT_TAGS = [
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "del",
  "strike",
  "code",
  "pre",
  "blockquote",
  "br",
  "hr",
  "p",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "sup",
  "sub",
]

const VOID_TAGS = ["br", "hr", "img"]

const DROPPED_TAGS = ["mx-reply", "script", "style"]

const LINK_SCHEMES = ["https:", "http:", "mailto:"]

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
}

const MAX_DEPTH = 100

const MAX_ENTITY_LENGTH = 10

const MAX_CODE_POINT = 0x10ffff

const NAME_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789-"

const SPACE = " \n\t\r\f"

const entityText = (name: string) => {
  if (!name.startsWith("#")) {
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : null
  }

  const hex = name[1] === "x" || name[1] === "X"
  const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10)

  return Number.isInteger(code) && code > 0 && code <= MAX_CODE_POINT
    ? String.fromCodePoint(code)
    : null
}

export const decodeEntities = (value: string) => {
  let result = ""
  let index = 0

  while (index < value.length) {
    const start = value.indexOf("&", index)

    if (start === -1) {
      break
    }

    const end = value.indexOf(";", start)
    const decoded =
      end !== -1 && end - start <= MAX_ENTITY_LENGTH
        ? entityText(value.slice(start + 1, end))
        : null

    result += value.slice(index, start) + (decoded ?? "&")
    index = decoded == null ? start + 1 : end + 1
  }

  return result + value.slice(index)
}

const readName = (html: string, start: number) => {
  let end = start

  while (
    end < html.length &&
    NAME_CHARS.includes(html.charAt(end).toLowerCase())
  ) {
    end += 1
  }

  return html.slice(start, end).toLowerCase()
}

const skipSpace = (html: string, start: number) => {
  let index = start

  while (index < html.length && SPACE.includes(html.charAt(index))) {
    index += 1
  }

  return index
}

const readAttributes = (html: string, start: number) => {
  const attributes = new Map<string, string>()
  let index = skipSpace(html, start)

  while (index < html.length && html[index] !== ">") {
    let nameEnd = index

    while (
      nameEnd < html.length &&
      !`${SPACE}=>`.includes(html.charAt(nameEnd))
    ) {
      nameEnd += 1
    }

    const name = html.slice(index, nameEnd).toLowerCase()

    index = skipSpace(html, nameEnd)

    if (html.charAt(index) !== "=") {
      continue
    }

    index = skipSpace(html, index + 1)

    const first = html.charAt(index)
    const quote = first === '"' || first === "'" ? first : null
    const valueStart = quote ? index + 1 : index
    let valueEnd = valueStart

    while (
      valueEnd < html.length &&
      !(quote ?? `${SPACE}>`).includes(html.charAt(valueEnd))
    ) {
      valueEnd += 1
    }

    attributes.set(name, decodeEntities(html.slice(valueStart, valueEnd)))
    index = skipSpace(html, quote ? valueEnd + 1 : valueEnd)
  }

  return { attributes, end: Math.min(index + 1, html.length) }
}

const safeHref = (value: string | undefined) => {
  const href = value?.trim() ?? ""

  return LINK_SCHEMES.some(scheme => href.toLowerCase().startsWith(scheme))
    ? href
    : null
}

const close = (stack: Frame[]) => {
  const frame = stack.pop()
  const parent = stack[stack.length - 1]

  if (!frame || !parent) {
    return
  }

  if (frame.tag === null) {
    parent.nodes.push(...frame.nodes)
  } else {
    parent.nodes.push({
      type: "element",
      tag: frame.tag,
      href: frame.href,
      children: frame.nodes,
    })
  }
}

const closeTag = (stack: Frame[], name: string, source: string[]) => {
  const depth = source.lastIndexOf(name)

  while (depth !== -1 && source.length > depth) {
    source.pop()
    close(stack)
  }
}

const pushText = (stack: Frame[], text: string) => {
  if (text !== "") {
    stack[stack.length - 1]?.nodes.push({ type: "text", text })
  }
}

export const parseFormattedBody = (html: string): FormattedNode[] => {
  const root: Frame = { tag: null, href: null, nodes: [] }
  const stack: Frame[] = [root]
  const source: string[] = []
  let index = 0

  while (index < html.length) {
    const open = html.indexOf("<", index)

    if (open === -1) {
      break
    }

    pushText(stack, decodeEntities(html.slice(index, open)))

    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open)

      index = end === -1 ? html.length : end + 3
      continue
    }

    const closing = html.charAt(open + 1) === "/"
    const name = readName(html, open + (closing ? 2 : 1))

    if (name === "") {
      pushText(stack, "<")
      index = open + 1
      continue
    }

    const { attributes, end } = readAttributes(
      html,
      open + (closing ? 2 : 1) + name.length,
    )

    index = end

    if (closing) {
      closeTag(stack, name, source)
    } else if (DROPPED_TAGS.includes(name)) {
      const stop = html.toLowerCase().indexOf(`</${name}`, index)

      index = stop === -1 ? html.length : readAttributes(html, stop).end
    } else if (VOID_TAGS.includes(name)) {
      if (KEPT_TAGS.includes(name)) {
        stack[stack.length - 1]?.nodes.push({
          type: "element",
          tag: name,
          href: null,
          children: [],
        })
      }
    } else if (stack.length < MAX_DEPTH) {
      source.push(name)
      stack.push({
        tag: KEPT_TAGS.includes(name) ? name : null,
        href: name === "a" ? safeHref(attributes.get("href")) : null,
        nodes: [],
      })
    }
  }

  pushText(stack, decodeEntities(html.slice(index)))

  while (stack.length > 1) {
    close(stack)
  }

  return root.nodes
}

export const plainText = (nodes: FormattedNode[]): string =>
  nodes
    .map(node => (node.type === "text" ? node.text : plainText(node.children)))
    .join("")
