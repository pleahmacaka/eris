import {
  applyAppearance,
  type ErisStyle,
  standaloneAppearance,
  type ThemePrefs,
} from "@eris/settings"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { tick } from "svelte"

export const erisStyle = $state<ErisStyle>({ linked: false, profile: null })

export const followEris = (prefs: ThemePrefs, command = "eris_style") => {
  $effect(() => {
    const look = standaloneAppearance(erisStyle, prefs)
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => applyAppearance(look, { restingShadow: true })

    apply()
    scheme.addEventListener("change", apply)

    return () => scheme.removeEventListener("change", apply)
  })

  $effect(() => {
    const current = getCurrentWindow()

    invoke<ErisStyle>(command)
      .then(next => {
        Object.assign(erisStyle, next)

        return tick()
      })
      .finally(() => current.show().then(() => current.setFocus()))

    const stop = listen<ErisStyle>("eris-style", e => {
      Object.assign(erisStyle, e.payload)
    })

    return () => {
      stop.then(unlisten => unlisten())
    }
  })
}
