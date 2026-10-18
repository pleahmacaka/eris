import { expect, mock, spyOn, test } from "bun:test"
import { defaultDevice, defaultProfile } from "@eris/settings"
import type { Panel } from "../../../src/lib/panel/panel.svelte"
import { subscribePanel } from "../../../src/lib/panel/subscriptions"

test("cleanup releases the clock, live collections, and listeners that register late", async () => {
  const profileStop = mock(() => {})
  const deviceStop = mock(() => {})
  const sharingStop = mock(() => {})
  const registration = Promise.withResolvers<() => void>()
  const onProfile = mock(
    async (_run: (profile: typeof defaultProfile) => void) =>
      registration.promise,
  )
  const onDevice = mock(
    async (_run: (device: typeof defaultDevice) => void) => deviceStop,
  )
  const watchScreenShare = mock(
    async (_run: (sharing: boolean) => void) => sharingStop,
  )
  const panel = {
    holidaysReady: false,
    profile: defaultProfile,
    device: defaultDevice,
    sharing: false,
    revealedDays: ["2026-03-07"],
    now: new Date(0),
    eventLive: { stop: mock(() => {}) },
    noteLive: { stop: mock(() => {}) },
  }
  const interval = spyOn(globalThis, "setInterval")
  const clear = spyOn(globalThis, "clearInterval")

  try {
    const stop = subscribePanel(panel as unknown as Panel, {
      loadHolidays: async () => {},
      ensureDevice: async () => defaultDevice,
      loadProfile: async () => defaultProfile,
      onProfile,
      onDevice,
      watchScreenShare,
    })

    expect(interval.mock.calls[0][1]).toBe(60_000)
    watchScreenShare.mock.calls[0][0](true)
    expect(panel.sharing).toBe(true)
    expect(panel.revealedDays).toEqual(["2026-03-07"])
    watchScreenShare.mock.calls[0][0](false)
    expect(panel.revealedDays).toEqual([])
    stop()
    expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value)
    expect(panel.eventLive.stop).toHaveBeenCalledTimes(1)
    expect(panel.noteLive.stop).toHaveBeenCalledTimes(1)
    expect(profileStop).not.toHaveBeenCalled()
    registration.resolve(profileStop)
    await onProfile.mock.results[0].value
    expect(profileStop).toHaveBeenCalledTimes(1)
    expect(deviceStop).toHaveBeenCalledTimes(1)
    expect(sharingStop).toHaveBeenCalledTimes(1)
    expect(panel.holidaysReady).toBe(true)
  } finally {
    clearInterval(
      interval.mock.results[0]?.value as ReturnType<typeof setInterval>,
    )
    interval.mockRestore()
    clear.mockRestore()
  }
})
