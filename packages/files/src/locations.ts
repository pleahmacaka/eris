export const HOME = "::{F874310E-B6B7-47DC-BC84-B9E6B38F5903}"

export const THIS_PC = "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}"

export const RECYCLE_BIN = "::{645FF040-5081-101B-9F08-00AA002F954E}"

export const SHARED = "::eris-shared"

export const HIDDEN = 0x2

export const SYSTEM = 0x4

export const WINDOWS =
  typeof navigator === "undefined" || navigator.userAgent.includes("Windows")

export const SEP = WINDOWS ? "\\" : "/"

export const pathKey = (path: string) => (WINDOWS ? path.toLowerCase() : path)

const trimSlashes = (path: string) => {
  const floor = WINDOWS ? 0 : 1
  let end = path.length

  while (end > floor && path[end - 1] === SEP) {
    end -= 1
  }

  return path.slice(0, end)
}

export const isUnc = (location: string) =>
  WINDOWS && location.startsWith("\\\\")

const isServer = (location: string) =>
  isUnc(location) &&
  trimSlashes(location).slice(2).split("\\").filter(Boolean).length === 1

export const isVirtual = (location: string) =>
  location.startsWith("::") ||
  location.toLowerCase().startsWith("shell:") ||
  isServer(location)

const isDriveLetter = (path: string) =>
  path.length >= 2 &&
  path[1] === ":" &&
  path[0].toLowerCase() !== path[0].toUpperCase()

export const isDriveRoot = (path: string) =>
  WINDOWS ? isDriveLetter(path) && trimSlashes(path).length === 2 : path === SEP

export const normalize = (location: string) => {
  if (location.startsWith("::")) {
    return location.toUpperCase()
  }

  if (isVirtual(location)) {
    return location
  }

  if (!WINDOWS) {
    return trimSlashes(location)
  }

  const path = location.replaceAll("/", "\\")

  return isDriveRoot(path)
    ? `${path.slice(0, 2).toUpperCase()}\\`
    : trimSlashes(path)
}

export const sameLocation = (a: string, b: string) =>
  pathKey(normalize(a)) === pathKey(normalize(b))

export const parentOf = (location: string): string | null => {
  if (isVirtual(location)) {
    return null
  }

  if (isDriveRoot(location)) {
    return THIS_PC
  }

  const path = trimSlashes(location)
  const at = path.lastIndexOf(SEP)

  if (!WINDOWS) {
    return at < 0 ? null : at === 0 ? SEP : path.slice(0, at)
  }

  if (at <= 0) {
    return null
  }

  const parent = path.slice(0, at)

  return isDriveRoot(parent) ? `${parent}\\` : parent
}

export const joinPath = (dir: string, name: string) =>
  dir.endsWith(SEP) ? `${dir}${name}` : `${dir}${SEP}${name}`

export const baseName = (path: string) => {
  const trimmed = trimSlashes(path)

  return trimmed.slice(trimmed.lastIndexOf(SEP) + 1) || trimmed
}

export const extensionOf = (name: string) => {
  const at = name.lastIndexOf(".")

  return at >= 0 ? name.slice(at).toLowerCase() : ""
}

export const segments = (path: string) => {
  if (!WINDOWS) {
    const parts = path.split(SEP).filter(Boolean)

    return [
      { name: SEP, path: SEP },
      ...parts.map((name, index) => ({
        name,
        path: `${SEP}${parts.slice(0, index + 1).join(SEP)}`,
      })),
    ]
  }

  const unc = isUnc(path)
  const parts = path.split("\\").filter(Boolean)
  const root = unc ? `\\\\${parts[0]}` : `${parts[0]}\\`
  const rest = parts.slice(1)

  return [root, ...rest].map((name, index) => ({
    name: index === 0 && !unc ? name.slice(0, 2) : baseName(name),
    path: index === 0 ? root : joinPath(root, rest.slice(0, index).join("\\")),
  }))
}
