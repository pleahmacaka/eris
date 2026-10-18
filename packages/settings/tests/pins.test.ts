import { expect, test } from "bun:test"
import { CUSTOM_PRESET, defaultProfile } from "../src/defaults"
import type { Profile } from "../src/model"
import { withProfileDefaults } from "../src/normalize"
import { commit, hasPin, receive, syncedOf, toggle } from "../src/pins"

const base = withProfileDefaults(defaultProfile)

const withLauncher = (profile: Profile, maxResults: number): Profile => ({
  ...profile,
  launcher: { ...profile.launcher, maxResults },
})

const withHue = (profile: Profile, accentHue: number): Profile => ({
  ...profile,
  presetId: CUSTOM_PRESET,
  appearance: { ...profile.appearance, accentHue },
})

test("without pins every boundary passes the profile through untouched", () => {
  expect(syncedOf(base, {})).toEqual(base)
  expect(JSON.stringify(receive(base, base, {}).profile)).toBe(
    JSON.stringify(base),
  )
  expect(receive(base, base, {}).pins).toEqual({})
  expect(commit(withLauncher(base, 9), {}, base)).toEqual({
    pins: {},
    changed: true,
  })
})

test("a pinned value never reaches the synced view", () => {
  const pinned = toggle(base, {}, "launcher.maxResults")
  const edited = withLauncher(base, 9)
  const saved = commit(edited, pinned.pins, syncedOf(base, pinned.pins))

  expect(pinned.changed).toBe(false)
  expect(hasPin(pinned.pins, "launcher.maxResults")).toBe(true)
  expect(saved.changed).toBe(false)
  expect(syncedOf(edited, saved.pins).launcher.maxResults).toBe(
    base.launcher.maxResults,
  )
})

test("a remote profile updates the hidden value and keeps this PC's own", () => {
  const { pins } = toggle(base, {}, "launcher.maxResults")
  const local = withLauncher(base, 9)
  const next = receive(withLauncher(base, 3), local, pins)

  expect(next.profile.launcher.maxResults).toBe(9)
  expect(next.pins.launcher?.maxResults).toBe(3)
})

test("an edit confined to pinned rows keeps the synced preset name", () => {
  const { pins } = toggle(base, {}, "appearance.accentHue")
  const edited = withHue(base, base.appearance.accentHue + 40)
  const saved = commit(edited, pins, syncedOf(base, pins))

  expect(saved.changed).toBe(false)
  expect(syncedOf(edited, saved.pins).presetId).toBe(base.presetId)
})

test("a remote built-in preset cannot reset a pinned look on load", () => {
  const { pins } = toggle(base, {}, "appearance.accentHue")
  const local = withHue(base, base.appearance.accentHue + 40)
  const next = receive(base, local, pins)

  expect(next.profile.presetId).toBe(CUSTOM_PRESET)
  expect(next.profile.appearance.accentHue).toBe(local.appearance.accentHue)
  expect(next.pins.presetId).toBe(base.presetId)
})

test("a pinned dock value keeps the built-in preset it tolerates", () => {
  const { pins } = toggle(base, {}, "appearance.dockOpacity")
  const local: Profile = {
    ...base,
    appearance: { ...base.appearance, dockOpacity: 0.7 },
  }

  expect(receive(base, local, pins).profile.presetId).toBe(base.presetId)
})

test("unpinning promotes this PC's value into sync", () => {
  const { pins } = toggle(base, {}, "launcher.maxResults")
  const local = withLauncher(base, 9)
  const unpinned = toggle(local, pins, "launcher.maxResults")

  expect(unpinned.changed).toBe(true)
  expect(unpinned.pins).toEqual({})
  expect(syncedOf(local, unpinned.pins).launcher.maxResults).toBe(9)
})
