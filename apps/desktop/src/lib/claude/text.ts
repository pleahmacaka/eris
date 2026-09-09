import { currentLocale } from "@eris/i18n"

export const folderNameOf = (folder: string) =>
  folder.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? ""

export const relative = (root: string, path: string) => {
  if (!root || !path.startsWith(root)) {
    return path
  }

  const rest = path.slice(root.length)

  return rest.startsWith("\\") || rest.startsWith("/") ? rest.slice(1) : rest
}

export const summary = (input: unknown) => {
  const fields = (input ?? {}) as Record<string, unknown>
  const value =
    fields.command ??
    fields.file_path ??
    fields.pattern ??
    fields.path ??
    fields.query ??
    fields.url ??
    fields.description ??
    fields.prompt

  return typeof value === "string"
    ? value
    : JSON.stringify(fields).slice(0, 160)
}

export const when = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString(currentLocale(), {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
