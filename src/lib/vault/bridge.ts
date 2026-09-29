import { BaseDirectory, writeTextFile } from "@tauri-apps/plugin-fs"

export const writeBridge = (root: string) =>
  writeTextFile(
    "bridge.json",
    `${JSON.stringify({ version: 1, vault: root }, null, 2)}\n`,
    {
      baseDir: BaseDirectory.AppData,
    },
  )
