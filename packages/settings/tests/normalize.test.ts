import { expect, test } from "bun:test"
import {
  DOCK_ALIGNS,
  DOCK_STYLES,
  defaultAppearance,
  defaultDevice,
  defaultProfile,
  defaultSync,
  presetAppearances,
  SYSTEM_FONT,
  standaloneLook,
  TERMINAL_APPS,
  WINDOW_BACKGROUNDS,
} from "../src/defaults"
import type { DeviceSettings, DockWidget, Profile } from "../src/model"
import { isLastEntryPoint } from "../src/model"
import {
  sanitizeWidgets,
  standaloneAppearance,
  withDeviceDefaults,
  withProfileDefaults,
} from "../src/normalize"

test("defaults retain shared identities and the built-in catalog", () => {
  expect(defaultProfile.appearance).toBe(defaultAppearance)
  expect(presetAppearances.arix).toBe(defaultAppearance)
  expect(defaultDevice.sync).toBe(defaultSync)
  expect(standaloneLook).toEqual({ ...defaultAppearance, mode: "system" })
  expect(DOCK_STYLES).toEqual(["windows", "mac"])
  expect(DOCK_ALIGNS).toEqual(["start", "center"])
  expect(TERMINAL_APPS).toEqual([
    "auto",
    "eris",
    "wt",
    "pwsh",
    "powershell",
    "cmd",
  ])
  expect(SYSTEM_FONT).toBe("system")
  expect(Object.keys(presetAppearances)).toEqual([
    "arix",
    "aurora",
    "glass",
    "mica",
    "nord",
    "catppuccin",
    "dracula",
    "solarized",
    "mono",
    "neon",
    "sunset",
    "forest",
    "ocean",
  ])
})

test("missing devices and profiles receive defaults without mutating them", () => {
  for (const saved of [undefined, null, {}]) {
    const device = withDeviceDefaults(saved)
    const profile = withProfileDefaults(saved)

    expect(device).toEqual(defaultDevice)
    expect(profile).toEqual(defaultProfile)
    expect(device).not.toBe(defaultDevice)
    expect(device.features).not.toBe(defaultDevice.features)
    expect(device.sync.collections).not.toBe(defaultSync.collections)
    expect(device.note).not.toBe(defaultDevice.note)
    expect(device.dockWidgets[0]).not.toBe(defaultDevice.dockWidgets[0])
    expect(profile.appearance).not.toBe(defaultAppearance)
    // Normalization deliberately does not deep-clone all nested defaults.
    expect(profile.calendar.tags).toBe(defaultProfile.calendar.tags)
  }
})

test("device normalization merges nested defaults and preserves false and zero", () => {
  const saved = {
    dockHeight: 40,
    features: { launcher: false },
    sync: {
      enabled: false,
      intervalMinutes: 0,
      collections: { todos: false },
    },
    note: { enabled: false, preview: false },
  } as unknown as Partial<DeviceSettings>
  const before = structuredClone(saved)
  const device = withDeviceDefaults(saved)

  expect(device.dockHeight).toBe(40)
  expect(device.features).toEqual({
    dock: true,
    launcher: false,
    calendar: true,
  })
  expect(device.sync).toEqual({
    ...defaultSync,
    enabled: false,
    intervalMinutes: 0,
    collections: { ...defaultSync.collections, todos: false },
  })
  expect(device.note).toEqual({
    ...defaultDevice.note,
    enabled: false,
    preview: false,
  })
  expect(saved).toEqual(before)
})

test("legacy chat false hides usage and is removed from features", () => {
  const disabled = withDeviceDefaults({
    showClaudeUsage: true,
    features: { chat: false, dock: false },
  } as unknown as Partial<DeviceSettings>)
  const enabled = withDeviceDefaults({
    showClaudeUsage: true,
    features: { chat: true },
  } as unknown as Partial<DeviceSettings>)

  expect(disabled.showClaudeUsage).toBe(false)
  expect(disabled.features).toEqual({
    dock: false,
    launcher: true,
    calendar: true,
  })
  expect(enabled.showClaudeUsage).toBe(true)
  expect(enabled.features).toEqual(defaultDevice.features)
})

test("either unknown dock field resets both fields, but valid values survive", () => {
  for (const saved of [
    { dockStyle: "legacy", dockAlign: "start" },
    { dockStyle: "mac", dockAlign: "legacy" },
  ]) {
    const device = withDeviceDefaults(
      saved as unknown as Partial<DeviceSettings>,
    )

    expect(device.dockStyle).toBe("windows")
    expect(device.dockAlign).toBe("center")
  }
  const valid = withDeviceDefaults({ dockStyle: "mac", dockAlign: "start" })

  expect(valid.dockStyle).toBe("mac")
  expect(valid.dockAlign).toBe("start")
})

test("widgets keep valid order, deduplicate ids, append missing kinds and normalize sizes", () => {
  const saved = [
    { id: "bad", kind: "unknown", size: 42 },
    { id: "bad", kind: "spacer", size: 4 },
    { id: "bad", kind: "apps", size: 9 },
    { id: "custom-tray", kind: "tray", size: 99 },
    { id: "zero", kind: "spacer", size: 0 },
    { id: "large", kind: "spacer", size: 48 },
  ] as DockWidget[]
  const before = structuredClone(saved)

  expect(sanitizeWidgets(saved)).toEqual([
    { id: "bad", kind: "spacer", size: 8 },
    { id: "custom-tray", kind: "tray", size: 0 },
    { id: "zero", kind: "spacer", size: 24 },
    { id: "large", kind: "spacer", size: 48 },
    { id: "lead", kind: "lead", size: 0 },
    { id: "apps", kind: "apps", size: 0 },
  ])
  expect(saved).toEqual(before)
  expect(sanitizeWidgets(undefined)).toEqual(defaultDevice.dockWidgets)
  expect(sanitizeWidgets([])).toEqual(defaultDevice.dockWidgets)
})

test("built-in presets track current values but retain dock and every window override", () => {
  const overrides = {
    dockOpacity: 0.4,
    dockRadius: 2,
    dockBackground: "glass" as const,
    ...Object.fromEntries(
      Object.values(WINDOW_BACKGROUNDS).map(key => [key, "solid"]),
    ),
  }
  const saved = {
    presetId: "aurora",
    appearance: {
      ...overrides,
      mode: "dark",
      background: "solid",
      accentHue: 50,
      fontScale: 2,
    },
  } as unknown as Partial<Profile>
  const before = structuredClone(saved)

  expect(withProfileDefaults(saved).appearance).toEqual({
    ...presetAppearances.aurora,
    ...overrides,
  })
  expect(saved).toEqual(before)
})

test("custom or absent presets merge appearance and nested profile defaults", () => {
  for (const presetId of ["custom", "", undefined]) {
    const saved = {
      ...(presetId !== undefined ? { presetId } : {}),
      appearance: { mode: "light", accentHue: 50 },
      launcher: { maxResults: 0, showTodos: false },
      calendar: { tags: [], weekStartsOn: 1 },
      todo: { showCompleted: true },
    } as unknown as Partial<Profile>
    const profile = withProfileDefaults(saved)

    expect(profile.appearance).toEqual({
      ...defaultAppearance,
      mode: "light",
      accentHue: 50,
    })
    expect(profile.launcher).toEqual({
      ...defaultProfile.launcher,
      maxResults: 0,
      showTodos: false,
    })
    expect(profile.calendar).toEqual({
      ...defaultProfile.calendar,
      tags: [],
      weekStartsOn: 1,
    })
    expect(profile.todo).toEqual({
      ...defaultProfile.todo,
      showCompleted: true,
    })
  }
})

test("standalone appearance follows Eris only when both switches are enabled", () => {
  const profile = { presetId: "glass" }
  for (const linked of [false, true]) {
    for (const followEris of [false, true]) {
      const appearance = standaloneAppearance(
        { linked, profile },
        { followEris, mode: "dark", look: { mode: "light", texture: 0.8 } },
      )

      expect(appearance).toEqual(
        linked && followEris
          ? presetAppearances.glass
          : { ...defaultAppearance, mode: "light", texture: 0.8 },
      )
    }
  }
  expect(
    standaloneAppearance(
      { linked: true, profile: null },
      { followEris: true, mode: "light" },
    ),
  ).toEqual(defaultAppearance)
})

test("only dock and launcher are entry points", () => {
  expect(
    isLastEntryPoint({ dock: true, launcher: false, calendar: true }, "dock"),
  ).toBe(true)
  expect(
    isLastEntryPoint(
      { dock: false, launcher: true, calendar: false },
      "launcher",
    ),
  ).toBe(true)
  expect(isLastEntryPoint(defaultDevice.features, "dock")).toBe(false)
  expect(
    isLastEntryPoint(
      { dock: false, launcher: false, calendar: true },
      "calendar",
    ),
  ).toBe(false)
})
