import init, { HwpDocument } from "@rhwp/core"
import wasmUrl from "@rhwp/core/rhwp_bg.wasm?url"

let ready: Promise<unknown> | undefined

const open = async (bytes: Uint8Array) => {
  ready ??= init({ module_or_path: wasmUrl }).catch(e => {
    ready = undefined
    throw e
  })
  await ready

  return new HwpDocument(bytes)
}

const yieldToUi = () => new Promise(done => setTimeout(done))

const pageImage = (svg: string) => {
  const img = document.createElement("img")

  img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  img.decoding = "async"
  img.draggable = false
  img.style.display = "block"
  img.style.maxWidth = "100%"
  img.style.height = "auto"
  img.style.background = "white"

  return img
}

const failedPage = () => {
  const box = document.createElement("div")

  box.style.width = "794px"
  box.style.maxWidth = "100%"
  box.style.aspectRatio = "210 / 297"
  box.style.border = "1px dashed currentColor"
  box.style.opacity = "0.4"

  return box
}

const clear = (host: HTMLElement, urls: string[]) => {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }

  host.replaceChildren()
}

export const renderHwp = async (bytes: Uint8Array, host: HTMLElement) => {
  const doc = await open(bytes)
  const urls: string[] = []
  let alive = true

  host.replaceChildren()
  host.style.overflowY = "auto"

  const pages = document.createElement("div")

  pages.style.display = "flex"
  pages.style.flexDirection = "column"
  pages.style.alignItems = "center"
  pages.style.gap = "1rem"
  pages.style.padding = "1rem"
  host.append(pages)

  const fill = async () => {
    try {
      const count = doc.pageCount()

      for (let i = 0; i < count && alive; i++) {
        try {
          const img = pageImage(doc.renderPageSvg(i))

          urls.push(img.src)
          pages.append(img)
        } catch {
          pages.append(failedPage())
        }

        await yieldToUi()
      }
    } finally {
      doc.free()
    }
  }

  fill()

  return () => {
    alive = false
    clear(host, urls)
  }
}

export const hwpThumbnail = async (
  bytes: Uint8Array,
  host: HTMLElement,
  width: number,
) => {
  const doc = await open(bytes)
  const urls: string[] = []

  try {
    const img = pageImage(doc.renderPageSvg(0))

    img.style.width = `${width}px`
    urls.push(img.src)
    host.replaceChildren(img)
  } finally {
    doc.free()
  }

  return () => clear(host, urls)
}
