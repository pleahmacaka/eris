import { type Appearance, standaloneLook, type ThemeMode } from "@eris/settings"
import { cloneDeep } from "es-toolkit"
import { DEFAULT_FONT } from "../ready"

export type Prefs = {
  shell: string | null
  fontFamily: string
  fontSize: number
  followEris: boolean
  mode: ThemeMode
  look: Appearance
}

const KEY = "eris-terminal.prefs"

const defaults: Prefs = {
  shell: null,
  fontFamily: DEFAULT_FONT,
  fontSize: 14,
  followEris: true,
  mode: "system",
  look: standaloneLook,
}

const read = (): Prefs => {
  try {
    const saved: Partial<Prefs> = JSON.parse(localStorage.getItem(KEY) ?? "{}")

    return {
      ...defaults,
      ...saved,
      look: {
        ...standaloneLook,
        mode: saved.mode ?? defaults.mode,
        ...saved.look,
      },
    }
  } catch {
    return cloneDeep(defaults)
  }
}

export const prefs = $state<Prefs>(read())

export const resetPrefs = () => {
  Object.assign(prefs, cloneDeep(defaults))
}

export const savePrefs = (snapshot: string) => {
  localStorage.setItem(KEY, snapshot)
}

window.addEventListener("storage", e => {
  if (e.key === KEY) {
    Object.assign(prefs, read())
  }
})
