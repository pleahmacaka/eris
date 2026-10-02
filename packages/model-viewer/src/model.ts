export type ObjScan = {
  vertices: number
  faces: number
  libraries: string[]
}

export const scanObj = (text: string): ObjScan => {
  let vertices = 0
  let faces = 0
  const libraries: string[] = []

  for (const raw of text.split("\n")) {
    const line = raw.trim()

    if (line.startsWith("v ") || line.startsWith("v\t")) {
      vertices++
    } else if (line.startsWith("f ") || line.startsWith("f\t")) {
      faces++
    } else if (line.startsWith("mtllib ")) {
      libraries.push(line.slice("mtllib ".length).trim())
    }
  }

  return { vertices, faces, libraries }
}

export const baseName = (path: string) =>
  path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1)

const isAbsolutePath = (path: string) =>
  path.startsWith("/") || path.startsWith("\\") || path.charAt(1) === ":"

const joinPath = (file: string, ref: string) => {
  const separator = file.includes("\\") ? "\\" : "/"
  const dir = file.replaceAll("\\", "/").split("/").slice(0, -1)
  const start = dir.findIndex(part => part !== "")
  const root = start === -1 ? dir : dir.slice(0, start)
  const parts = start === -1 ? [] : dir.slice(start)
  const floor = parts[0]?.endsWith(":") ? 1 : 0

  for (const part of ref.replaceAll("\\", "/").split("/")) {
    if (part === "..") {
      if (parts.length > floor) {
        parts.pop()
      }
    } else if (part !== "." && part !== "") {
      parts.push(part)
    }
  }

  return [...root, ...parts].join(separator)
}

export const resolveAsset = (ref: string, base: string): string | null => {
  try {
    const url = new URL(base, globalThis.location?.href)
    const cut = url.pathname.lastIndexOf("/") + 1
    const file = decodeURIComponent(url.pathname.slice(cut))

    // Tauri convertFileSrc packs the whole path into one encoded segment
    if (file.includes("/") || file.includes("\\")) {
      const path = isAbsolutePath(ref) ? ref : joinPath(file, ref)

      url.pathname = `${url.pathname.slice(0, cut)}${encodeURIComponent(path)}`
      url.search = ""
      url.hash = ""

      return url.href
    }

    return new URL(ref.replaceAll("\\", "/"), url).href
  } catch {
    return null
  }
}

export const fileName = (url: string) => {
  try {
    const { pathname, protocol } = new URL(url)

    return protocol === "data:"
      ? ""
      : baseName(decodeURIComponent(baseName(pathname)))
  } catch {
    return baseName(url)
  }
}

export const fitDistance = (radius: number, fov: number, aspect: number) => {
  const vertical = (fov * Math.PI) / 360
  const horizontal = Math.atan(Math.tan(vertical) * (aspect > 0 ? aspect : 1))

  return radius / Math.sin(Math.min(vertical, horizontal))
}
