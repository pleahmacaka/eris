export type DocKind = "hwp" | "docx" | "sheet" | "slides"

type Render = (bytes: Uint8Array, host: HTMLElement) => Promise<() => void>

type Thumbnail = (
  bytes: Uint8Array,
  host: HTMLElement,
  width: number,
) => Promise<() => void>

const KINDS: Record<string, DocKind> = {
  ".hwp": "hwp",
  ".hwpx": "hwp",
  ".docx": "docx",
  ".docm": "docx",
  ".xlsx": "sheet",
  ".xlsm": "sheet",
  ".xls": "sheet",
  ".ods": "sheet",
  ".csv": "sheet",
  ".tsv": "sheet",
  ".pptx": "slides",
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf(".")

  return dot < 0 ? "" : name.slice(dot).toLowerCase()
}

export const docKind = (name: string): DocKind | null =>
  KINDS[extensionOf(name)] ?? null

const renderers = async (
  kind: DocKind,
): Promise<{ full: Render; thumbnail: Thumbnail }> => {
  switch (kind) {
    case "hwp": {
      const { renderHwp, hwpThumbnail } = await import("./hwp")

      return { full: renderHwp, thumbnail: hwpThumbnail }
    }
    case "docx": {
      const { renderDocx, docxThumbnail } = await import("./docx")

      return { full: renderDocx, thumbnail: docxThumbnail }
    }
    case "sheet": {
      const { renderSheet, sheetThumbnail } = await import("./sheet")

      return { full: renderSheet, thumbnail: sheetThumbnail }
    }
    case "slides": {
      const { renderSlides, slidesThumbnail } = await import("./slides")

      return { full: renderSlides, thumbnail: slidesThumbnail }
    }
  }
}

export const renderDocument = async (
  bytes: Uint8Array,
  name: string,
  host: HTMLElement,
) => {
  const kind = docKind(name)

  if (!kind) {
    throw new Error(`unsupported document: ${name}`)
  }

  return (await renderers(kind)).full(bytes, host)
}

export const documentThumbnail = async (
  bytes: Uint8Array,
  name: string,
  host: HTMLElement,
  width: number,
) => {
  const kind = docKind(name)

  if (!kind) {
    throw new Error(`unsupported document: ${name}`)
  }

  return (await renderers(kind)).thumbnail(bytes, host, width)
}
