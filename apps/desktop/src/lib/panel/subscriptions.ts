import { loadProfile, onDevice, onProfile } from "@eris/settings"
import { loadHolidays } from "#lib/calendar/index.js"
import { ensureDevice } from "#lib/device.js"
import * as native from "#lib/native/index.js"
import type { Panel } from "./panel.svelte"

export const subscribePanel = (
  panel: Panel,
  operations = {
    loadHolidays,
    ensureDevice,
    loadProfile,
    onProfile,
    onDevice,
    watchScreenShare: native.watchScreenShare,
  },
) => {
  const {
    loadHolidays,
    ensureDevice,
    loadProfile,
    onProfile,
    onDevice,
    watchScreenShare,
  } = operations

  loadHolidays().then(() => (panel.holidaysReady = true))
  ensureDevice()
    .then(d => {
      panel.device = d
    })
    .catch(() => undefined)
  loadProfile().then(p => {
    panel.profile = p
  })

  const stops = [
    onProfile(p => {
      panel.profile = p
    }),
    onDevice(d => {
      panel.device = d
    }),
    watchScreenShare(value => {
      panel.sharing = value

      if (!value) {
        panel.revealedDays = []
      }
    }),
  ]

  const clock = setInterval(() => {
    panel.now = new Date()
  }, 60_000)

  return () => {
    clearInterval(clock)

    // Listeners may still be registering when the panel unmounts.
    for (const stop of stops) {
      stop.then(fn => fn())
    }

    panel.eventLive.stop()
    panel.noteLive.stop()
  }
}
