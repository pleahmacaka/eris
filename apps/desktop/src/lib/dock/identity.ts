import type { AppEntry } from "../native/apps"
import type { WindowEntry } from "../native/windows"

const normalized = (path: string) => path.replaceAll("/", "\\").toLowerCase()

export const fallbackPin = (path: string, name: string): AppEntry => {
  const executable = path.toLowerCase().endsWith(".exe") ? path : null
  const prefix = "shell:AppsFolder\\"
  const appId = path.startsWith(prefix) ? path.slice(prefix.length) : null
  return {
    id: path,
    name,
    path,
    kind: executable ? "exe" : appId ? "store" : "shortcut",
    subtitle: "",
    app_id: appId,
    executable,
    icon_executable: null,
    argument_executables: [],
  }
}

// Unmatched windows stay grouped by executable, which is also their Dock order
// and launch path. App IDs are used separately to match specific shortcut pins.
export const windowIdentity = (entry: WindowEntry) =>
  entry.process
    ? `exe:${normalized(entry.process)}`
    : entry.app_id
      ? `app:${entry.app_id.toLowerCase()}`
      : `window:${entry.hwnd}`

export const matchPin = (app: AppEntry, entry: WindowEntry): number => {
  if (app.app_id && entry.app_id) {
    return app.app_id.toLowerCase() === entry.app_id.toLowerCase() ? 3 : 0
  }

  if (!entry.process) {
    return 0
  }
  const process = normalized(entry.process)
  if (app.executable && normalized(app.executable) === process) {
    return 2
  }
  if (app.icon_executable && normalized(app.icon_executable) === process) {
    return 1
  }
  if (app.kind === "exe" && normalized(app.path) === process) {
    return 2
  }
  const executable = app.executable ?? (app.kind === "exe" ? app.path : null)
  if (executable) {
    const target = normalized(executable)
    const directory = target.slice(0, target.lastIndexOf("\\") + 1)
    // Only helpers inside the launcher's installation tree count. Otherwise an
    // ordinary app launched by Explorer, a terminal, or a browser would inherit
    // that unrelated launcher's pin. A drive root is not an installation tree.
    const insideInstallation =
      directory.length > 3 && process.startsWith(directory)
    const file = process.slice(process.lastIndexOf("\\") + 1)
    if (
      insideInstallation &&
      app.argument_executables?.some(name => name.toLowerCase() === file)
    ) {
      return 1
    }
    if (
      insideInstallation &&
      entry.ancestor_executables?.some(path => normalized(path) === target)
    ) {
      return 1
    }
  }
  // Older cached entries and Studio fixtures predate native identity metadata.
  // Never apply basename matching to an entry returned by the current backend.
  if (
    app.app_id === undefined &&
    app.executable === undefined &&
    app.icon_executable === undefined &&
    app.argument_executables === undefined
  ) {
    const file = process.slice(process.lastIndexOf("\\") + 1)
    const path = normalized(app.path)
    const legacyExecutable =
      app.subtitle.toLowerCase() || path.slice(path.lastIndexOf("\\") + 1)
    if (legacyExecutable === file && file.endsWith(".exe")) {
      return 1
    }
  }
  return 0
}
