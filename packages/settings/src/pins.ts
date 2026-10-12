import { isEqual, omit, omitBy, pick } from "es-toolkit"
import { CUSTOM_PRESET } from "./defaults"
import type { Appearance, PinPath, PinSection, Pins, Profile } from "./model"
import { withProfileDefaults } from "./normalize"

const parse = (path: PinPath) => {
  const [section, key] = path.split(".")

  return { section: section as PinSection, key }
}

const entries = (source: Profile | Pins, section: PinSection) =>
  ({ ...source[section] }) as Record<string, unknown>

export const hasPin = (pins: Pins, path: PinPath) => {
  const { section, key } = parse(path)

  return key in entries(pins, section)
}

// the profile other devices see: this PC's values with the hidden synced ones swapped back in
export const syncedOf = (local: Profile, pins: Pins): Profile => ({
  ...local,
  presetId: pins.presetId ?? local.presetId,
  appearance: { ...local.appearance, ...pins.appearance },
  launcher: { ...local.launcher, ...pins.launcher },
  calendar: { ...local.calendar, ...pins.calendar },
})

// a built-in presetId resets the look on load, so it only survives when the look still matches it
export const presetFor = (appearance: Appearance, presetId: string) =>
  isEqual(withProfileDefaults({ presetId, appearance }).appearance, appearance)
    ? presetId
    : CUSTOM_PRESET

const prune = (pins: Pins): Pins =>
  omitBy(pins, value => value === undefined || isEqual(value, {}))

// a local edit confined to pinned rows flips presetId to custom; the synced look keeps its name
export const commit = (local: Profile, pins: Pins, before: Profile) => {
  const hidden = omit(pins, ["presetId"])
  const keep =
    !!hidden.appearance &&
    local.presetId === CUSTOM_PRESET &&
    isEqual(syncedOf(local, hidden).appearance, before.appearance)
  const next = keep ? { ...hidden, presetId: before.presetId } : hidden

  return { pins: next, changed: !isEqual(syncedOf(local, next), before) }
}

export const receive = (remote: Profile, local: Profile, pins: Pins) => {
  const split = <T extends object>(
    incoming: T,
    own: T,
    pinned: Partial<T> = {},
  ) => {
    const keys = Object.keys(pinned) as (keyof T)[]

    return {
      shown: { ...incoming, ...pick(own, keys) },
      hidden: keys.length > 0 ? pick(incoming, keys) : undefined,
    }
  }

  const appearance = split(remote.appearance, local.appearance, pins.appearance)
  const launcher = split(remote.launcher, local.launcher, pins.launcher)
  const calendar = split(remote.calendar, local.calendar, pins.calendar)
  const presetId = presetFor(appearance.shown, remote.presetId)

  return {
    profile: {
      ...remote,
      presetId,
      appearance: appearance.shown,
      launcher: launcher.shown,
      calendar: calendar.shown,
    },
    pins: prune({
      presetId: presetId === remote.presetId ? undefined : remote.presetId,
      appearance: appearance.hidden,
      launcher: launcher.hidden,
      calendar: calendar.hidden,
    }),
  }
}

export const toggle = (local: Profile, pins: Pins, path: PinPath) => {
  const { section, key } = parse(path)
  const before = syncedOf(local, pins)

  if (!hasPin(pins, path)) {
    const values = {
      ...entries(pins, section),
      [key]: entries(local, section)[key],
    }

    return { pins: { ...pins, [section]: values }, changed: false }
  }

  const values = omit(entries(pins, section), [key])

  return commit(local, prune({ ...pins, [section]: values }), before)
}
