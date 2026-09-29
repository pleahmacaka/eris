import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager"

export const copyText = (text: string) => writeText(text)

export const pasteText = async () => (await readText()) ?? ""
