import { resolve } from "node:path"

export const apps = {
  desktop: { port: 9310, schemes: ["eris-dev", "eris-files-dev"] },
  files: { port: 9311, schemes: ["eris-files-dev"] },
  terminal: { port: 9312, schemes: ["eris-terminal-dev"] },
} as const

export type AppName = keyof typeof apps
export const root = resolve(import.meta.dir, "..")

export function appName(value: string): AppName {
  if (!Object.hasOwn(apps, value)) {
    throw new Error(
      `Unknown app "${value}". Choose desktop, files, or terminal.`,
    )
  }
  return value as AppName
}

export async function readAppConfig(app: AppName) {
  const config = await Bun.file(
    resolve(root, "apps", app, "src-tauri", "tauri.conf.json"),
  ).json()
  if (
    typeof config.identifier !== "string" ||
    typeof config.productName !== "string" ||
    typeof config.build?.devUrl !== "string"
  ) {
    throw new Error(`Invalid Tauri config for ${app}.`)
  }
  return config as {
    identifier: string
    productName: string
    build: { devUrl: string }
    app: { windows: Record<string, unknown>[] }
  }
}

export function requireWindows(platform = process.platform) {
  if (platform !== "win32") {
    throw new Error("WebView2 debugging and --headless require Windows.")
  }
}
