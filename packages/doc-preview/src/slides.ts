import JSZip from "jszip"

const CLASS = "eris-slides"

const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  rel: "http://schemas.openxmlformats.org/package/2006/relationships",
}

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
}

const TITLE_TYPES = new Set(["title", "ctrTitle"])

const SKIPPED_TYPES = new Set(["sldNum", "dt", "ftr"])

const STYLE = `
.${CLASS} {
  --line: color-mix(in srgb, currentColor 14%, transparent);
  height: 100%;
  overflow: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-sizing: border-box;
  font: inherit;
}
.${CLASS}-card {
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: none;
}
.${CLASS}-head { display: flex; align-items: baseline; gap: 0.625rem; }
.${CLASS}-number {
  font-size: 0.75rem;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
.${CLASS}-title { margin: 0; font-size: 1.0625rem; font-weight: 600; }
.${CLASS}-body { margin: 0; padding-left: 1.25rem; list-style: disc; display: flex; flex-direction: column; gap: 0.25rem; }
.${CLASS}-body li { line-height: 1.5; }
.${CLASS}-card img {
  max-width: 100%;
  max-height: 16rem;
  object-fit: contain;
  align-self: flex-start;
  border-radius: 0.25rem;
}
.${CLASS}-empty { opacity: 0.55; font-size: 0.875rem; }
.${CLASS}-thumb { height: auto; overflow: hidden; padding: 0; }
.${CLASS}-thumb .${CLASS}-card {
  overflow: hidden;
  padding: 6% 7%;
  gap: 0.4em;
  font-size: var(--thumb-font);
}
.${CLASS}-thumb .${CLASS}-title { font-size: 1.4em; }
.${CLASS}-thumb .${CLASS}-number { display: none; }
.${CLASS}-thumb .${CLASS}-body { gap: 0.15em; padding-left: 1.2em; }
.${CLASS}-thumb .${CLASS}-card img { max-height: 45%; min-height: 0; }
`

type Slide = {
  title: string
  lines: { text: string; level: number }[]
  image: Blob | null
}

const parse = (xml: string) =>
  new DOMParser().parseFromString(xml, "application/xml")

const placeholderType = (shape: Element) =>
  shape.getElementsByTagNameNS(NS.p, "ph")[0]?.getAttribute("type") ?? ""

const paragraphText = (paragraph: Element) =>
  [...paragraph.getElementsByTagNameNS(NS.a, "t")]
    .map(e => e.textContent ?? "")
    .join("")
    .trim()

const relations = async (zip: JSZip, path: string) => {
  const slash = path.lastIndexOf("/")
  const relsPath = `${path.slice(0, slash)}/_rels/${path.slice(slash + 1)}.rels`
  const xml = await zip.file(relsPath)?.async("string")
  const map = new Map<string, string>()

  if (!xml) {
    return map
  }

  for (const rel of parse(xml).getElementsByTagNameNS(NS.rel, "Relationship")) {
    const target = rel.getAttribute("Target") ?? ""
    const resolved = new URL(target, `file:///${path}`).pathname.slice(1)

    map.set(rel.getAttribute("Id") ?? "", resolved)
  }

  return map
}

const firstImage = async (
  zip: JSZip,
  doc: Document,
  rels: Map<string, string>,
) => {
  for (const blip of doc.getElementsByTagNameNS(NS.a, "blip")) {
    const path = rels.get(blip.getAttributeNS(NS.r, "embed") ?? "")
    const type = IMAGE_TYPES[path?.split(".").pop()?.toLowerCase() ?? ""]
    const file = path ? zip.file(path) : null

    if (file && type) {
      return new Blob([await file.async("arraybuffer")], { type })
    }
  }

  return null
}

const readSlide = async (zip: JSZip, path: string): Promise<Slide> => {
  const xml = (await zip.file(path)?.async("string")) ?? ""
  const doc = parse(xml)
  const shapes = [...doc.getElementsByTagNameNS(NS.p, "sp")]
  const titleShape = shapes.find(s => TITLE_TYPES.has(placeholderType(s)))
  const lines: Slide["lines"] = []

  for (const paragraph of doc.getElementsByTagNameNS(NS.a, "p")) {
    const shape = paragraph.closest("sp")
    const text = paragraphText(paragraph)

    if (!text || shape === titleShape) {
      continue
    }

    if (shape && SKIPPED_TYPES.has(placeholderType(shape))) {
      continue
    }

    const level = paragraph
      .getElementsByTagNameNS(NS.a, "pPr")[0]
      ?.getAttribute("lvl")

    lines.push({ text, level: Number(level ?? 0) })
  }

  const title = titleShape
    ? [...titleShape.getElementsByTagNameNS(NS.a, "p")]
        .map(paragraphText)
        .filter(Boolean)
        .join(" ")
    : ""

  return {
    title,
    lines,
    image: await firstImage(zip, doc, await relations(zip, path)),
  }
}

const readDeck = async (bytes: Uint8Array, limit = Infinity) => {
  const zip = await JSZip.loadAsync(bytes)
  const presentationPath = "ppt/presentation.xml"
  const presentation = parse(
    (await zip.file(presentationPath)?.async("string")) ?? "",
  )
  const rels = await relations(zip, presentationPath)
  const size = presentation.getElementsByTagNameNS(NS.p, "sldSz")[0]
  const ratio =
    Number(size?.getAttribute("cx") ?? 16) /
    Number(size?.getAttribute("cy") ?? 9)
  const paths = [...presentation.getElementsByTagNameNS(NS.p, "sldId")]
    .map(e => rels.get(e.getAttributeNS(NS.r, "id") ?? ""))
    .filter(path => path !== undefined)
    .slice(0, limit)
  const slides = await Promise.all(paths.map(path => readSlide(zip, path)))

  return { slides, ratio }
}

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = "",
) => {
  const node = document.createElement(tag)

  node.className = className
  node.textContent = text

  return node
}

const card = (slide: Slide, index: number, urls: string[]) => {
  const root = element("article", `${CLASS}-card`)
  const head = element("header", `${CLASS}-head`)
  const title = slide.title || (slide.lines.length ? "" : "제목 없음")

  head.append(element("span", `${CLASS}-number`, String(index + 1)))

  if (title) {
    head.append(element("h3", `${CLASS}-title`, title))
  }

  root.append(head)

  if (slide.lines.length) {
    const list = element("ul", `${CLASS}-body`)

    for (const line of slide.lines) {
      const item = element("li", "", line.text)

      item.style.marginLeft = `${line.level * 1.25}rem`
      list.append(item)
    }

    root.append(list)
  }

  if (slide.image) {
    const image = element("img")
    const url = URL.createObjectURL(slide.image)

    urls.push(url)
    image.src = url
    image.alt = ""
    root.append(image)
  }

  return root
}

const mount = (host: HTMLElement, className: string) => {
  const root = element("div", className)

  root.append(element("style", "", STYLE))
  host.replaceChildren(root)

  return root
}

const cleanup = (host: HTMLElement, urls: string[]) => () => {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }

  host.replaceChildren()
}

export const renderSlides = async (bytes: Uint8Array, host: HTMLElement) => {
  const { slides } = await readDeck(bytes)
  const root = mount(host, CLASS)
  const urls: string[] = []

  root.append(...slides.map((slide, i) => card(slide, i, urls)))

  if (!slides.length) {
    root.append(element("div", `${CLASS}-empty`, "슬라이드 없음"))
  }

  return cleanup(host, urls)
}

export const slidesThumbnail = async (
  bytes: Uint8Array,
  host: HTMLElement,
  width: number,
) => {
  const { slides, ratio } = await readDeck(bytes, 1)
  const root = mount(host, `${CLASS} ${CLASS}-thumb`)
  const urls: string[] = []

  root.style.width = `${width}px`
  root.style.setProperty("--thumb-font", `${width / 28}px`)

  if (slides[0]) {
    const first = card(slides[0], 0, urls)

    first.style.aspectRatio = String(ratio)
    root.append(first)
  }

  return cleanup(host, urls)
}
