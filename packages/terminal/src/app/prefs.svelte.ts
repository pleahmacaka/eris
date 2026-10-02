import type { ThemeMode } from "@eris/settings"
import { DEFAULT_FONT } from "../ready"

export type Prefs = {
  shell: string | null
  fontFamily: string
  fontSize: number
  followEris: boolean
  mode: ThemeMode
}

const KEY = "eris-terminal.prefs"

const defaults: Prefs = {
  shell: null,
  fontFamily: DEFAULT_FONT,
  fontSize: 14,
  followEris: true,
  mode: "system",
}

const read = (): Prefs => {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }
  } catch {
    return defaults
  }
}

export const prefs = $state<Prefs>(read())

export const savePrefs = (snapshot: string) => {
  localStorage.setItem(KEY, snapshot)
}

window.addEventListener("storage", e => {
  if (e.key === KEY) {
    Object.assign(prefs, read())
  }
})
