export const HOME = "::{F874310E-B6B7-47DC-BC84-B9E6B38F5903}"

export const THIS_PC = "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}"

export const RECYCLE_BIN = "::{645FF040-5081-101B-9F08-00AA002F954E}"

export const DEVICE = "eris-device:"

export const HIDDEN = 0x2

export const SYSTEM = 0x4

export const CLOUD_ONLY = 0x1000 | 0x40000 | 0x400000

export const WINDOWS =
  typeof navigator === "undefined" || navigator.userAgent.includes("Windows")

export const SEP = WINDOWS ? "\\" : "/"

export const isDevice = (location: string) => location.startsWith(DEVICE)

export const pathKey = (path: string) =>
  WINDOWS && !isDevice(path) ? path.toLowerCase() : path

export const deviceLocation = (id: string, path: string | null = null) =>
  path === null ? `${DEVICE}${id}` : `${DEVICE}${id}|${path}`

export const splitDevice = (location: string) => {
  if (!isDevice(location)) {
    return null
  }

  const rest = location.slice(DEVICE.length)
  const bar = rest.indexOf("|")

  return bar < 0
    ? { id: rest, path: null }
    : { id: rest.slice(0, bar), path: rest.slice(bar + 1) }
}

const deviceRoots = new Map<string, Set<string>>()

export const rememberRoots = (id: string, roots: string[]) => {
  deviceRoots.set(id, new Set(roots))
}

const remoteParts = (path: string) => {
  const sep = path.includes("\\") ? "\\" : "/"

  return { sep, parts: path.split(sep).filter(Boolean) }
}

export const remoteName = (path: string) =>
  remoteParts(path).parts.at(-1) ?? path

const remoteParent = (path: string) => {
  const { sep, parts } = remoteParts(path)

  if (sep === "/") {
    return parts.length ? `/${parts.slice(0, -1).join("/")}` : null
  }

  if (parts.length < 2) {
    return null
  }

  return parts.length === 2 ? `${parts[0]}\\` : parts.slice(0, -1).join("\\")
}

const deviceParent = (id: string, path: string | null) => {
  if (path === null) {
    return THIS_PC
  }

  const root = deviceRoots.get(id)?.has(path) ?? false

  return deviceLocation(id, root ? null : remoteParent(path))
}

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

const CONTROL_PANELS = [
  "SHELL:CONTROLPANELFOLDER",
  "::{26EE0668-A00A-44D7-9371-BEB064C98683}",
  "::{21EC2020-3AEA-1069-A2DD-08002B30309D}",
]

export const isControlPanel = (location: string) => {
  const upper = location.toUpperCase()

  return CONTROL_PANELS.some(panel => upper.startsWith(panel))
}

export const isVirtual = (location: string) =>
  location.startsWith("::") ||
  isDevice(location) ||
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
  const device = splitDevice(location)

  if (device) {
    return deviceParent(device.id, device.path)
  }

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
