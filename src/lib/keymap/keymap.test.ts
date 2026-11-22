import { describe, expect, test } from "bun:test"
import { ACTIONS } from "./actions"
import { bindingOf, type KeyStroke, parseBinding } from "./binding"
import {
  actionsFor,
  conflictOf,
  KEYMAP_KEY,
  loadOverrides,
  type Overrides,
  parseOverrides,
  resolveKeymap,
  saveOverrides,
  swapKeys,
  withEnabled,
  withKey,
  withoutOverride,
} from "./keymap"

const IDLE = { typing: false, modal: false }

const TYPING = { typing: true, modal: false }

const MODAL = { typing: false, modal: true }

const storage = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

const stroke = (
  key: string,
  code: string,
  held: Partial<KeyStroke> = {},
): KeyStroke => ({
  key,
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  isComposing: false,
  keyCode: 0,
  getModifierState: () => false,
  ...held,
})

const ids = (overrides: Overrides, binding: string, context = IDLE) =>
  actionsFor(resolveKeymap(overrides), binding, context).map(
    action => action.id,
  )

describe("defaults", () => {
  test("are canonical on every platform", () => {
    for (const action of ACTIONS) {
      expect(parseBinding(action.key, false)).toBe(action.key)
      expect(parseBinding(action.key, true)).toBe(action.key)
    }
  })

  test("never share a binding", () => {
    const keys = ACTIONS.map(action => action.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  test("resolve without overrides", () => {
    const keymap = resolveKeymap({})

    expect(keymap.quickSwitch).toEqual({
      key: "Mod+K",
      enabled: true,
      custom: false,
    })
    expect(Object.keys(keymap)).toEqual(ACTIONS.map(action => action.id))
  })
})

describe("overrides", () => {
  test("rebind, clear and restore a binding", () => {
    const rebound = withKey({}, "quickSwitch", "Mod+P")

    expect(rebound).toEqual({ quickSwitch: { key: "Mod+P" } })
    expect(resolveKeymap(rebound).quickSwitch).toEqual({
      key: "Mod+P",
      enabled: true,
      custom: true,
    })
    expect(withKey(rebound, "quickSwitch", null)).toEqual({
      quickSwitch: { key: null },
    })
    expect(withKey(rebound, "quickSwitch", "Mod+K")).toEqual({})
  })

  test("disable and enable without losing the binding", () => {
    const rebound = withKey({}, "toggleMute", "Mod+M")
    const disabled = withEnabled(rebound, "toggleMute", false)

    expect(disabled).toEqual({ toggleMute: { key: "Mod+M", off: true } })
    expect(resolveKeymap(disabled).toggleMute.enabled).toBe(false)
    expect(withEnabled(disabled, "toggleMute", true)).toEqual(rebound)
    expect(
      withEnabled(withEnabled({}, "toggleMute", false), "toggleMute", true),
    ).toEqual({})
  })

  test("reset one action and leave the others", () => {
    const overrides = withKey(
      withKey({}, "quickSwitch", "Mod+P"),
      "openSettings",
      "F2",
    )

    expect(withoutOverride(overrides, "quickSwitch")).toEqual({
      openSettings: { key: "F2" },
    })
  })

  test("swap the bindings of two actions", () => {
    const swapped = resolveKeymap(swapKeys({}, "openSettings", "quickSwitch"))

    expect(swapped.openSettings.key).toBe("Mod+K")
    expect(swapped.quickSwitch.key).toBe("Mod+,")
  })

  test("swap with an unbound action clears the other one", () => {
    const unbound = withKey({}, "openSettings", null)
    const swapped = resolveKeymap(
      swapKeys(unbound, "openSettings", "quickSwitch"),
    )

    expect(swapped.openSettings.key).toBe("Mod+K")
    expect(swapped.quickSwitch.key).toBeNull()
  })
})

describe("conflictOf", () => {
  test("names the action that already holds a binding", () => {
    const keymap = resolveKeymap({})

    expect(conflictOf(keymap, "openSettings", "Mod+K")).toBe("quickSwitch")
    expect(conflictOf(keymap, "quickSwitch", "Mod+K")).toBeNull()
    expect(conflictOf(keymap, "openSettings", "Mod+J")).toBeNull()
    expect(conflictOf(keymap, "openSettings", null)).toBeNull()
  })

  test("counts disabled actions and follows overrides", () => {
    const overrides = withEnabled(
      withKey({}, "quickSwitch", "Mod+P"),
      "quickSwitch",
      false,
    )
    const keymap = resolveKeymap(overrides)

    expect(conflictOf(keymap, "openSettings", "Mod+P")).toBe("quickSwitch")
    expect(conflictOf(keymap, "openSettings", "Mod+K")).toBeNull()
  })
})

describe("actionsFor", () => {
  test("finds the action bound to a key event", () => {
    const pc = bindingOf(stroke("k", "KeyK", { ctrlKey: true }), false)
    const mac = bindingOf(stroke("ㅏ", "KeyK", { metaKey: true }), true)

    expect(pc).toBe("Mod+K")
    expect(mac).toBe("Mod+K")
    expect(ids({}, "Mod+K")).toEqual(["quickSwitch"])
  })

  test("does not treat Ctrl as Mod on macOS", () => {
    const binding = bindingOf(stroke("k", "KeyK", { ctrlKey: true }), true)

    expect(ids({}, binding ?? "")).toEqual([])
  })

  test("never matches a key event from IME composition", () => {
    const composing = bindingOf(
      stroke("Process", "KeyK", { ctrlKey: true, keyCode: 229 }),
      false,
    )

    expect(composing).toBeNull()
  })

  test("follows a rebound key and drops the old one", () => {
    const overrides = withKey({}, "quickSwitch", "Mod+P")

    expect(ids(overrides, "Mod+P")).toEqual(["quickSwitch"])
    expect(ids(overrides, "Mod+K")).toEqual([])
  })

  test("skips disabled actions", () => {
    expect(ids(withEnabled({}, "quickSwitch", false), "Mod+K")).toEqual([])
  })

  test("runs chords and Escape while typing", () => {
    expect(ids({}, "Mod+K", TYPING)).toEqual(["quickSwitch"])
    expect(ids({}, "Alt+ArrowDown", TYPING)).toEqual(["nextChannel"])
    expect(ids({}, "Escape", TYPING)).toEqual(["markChannelRead"])
    expect(ids({}, "PageUp", TYPING)).toEqual(["scrollUp"])
  })

  test("keeps plain keys for the text field while typing", () => {
    const overrides = withKey({}, "nextChannel", "J")

    expect(ids({}, "/")).toEqual(["focusMessage"])
    expect(ids({}, "/", TYPING)).toEqual([])
    expect(ids(overrides, "J")).toEqual(["nextChannel"])
    expect(ids(overrides, "J", TYPING)).toEqual([])
  })

  test("runs only global actions while a dialog is open", () => {
    expect(ids({}, "Mod+K", MODAL)).toEqual(["quickSwitch"])
    expect(ids({}, "Mod+Shift+M", MODAL)).toEqual(["toggleMute"])
    expect(ids({}, "Escape", MODAL)).toEqual([])
    expect(ids({}, "Alt+ArrowDown", MODAL)).toEqual([])
    expect(ids({}, "Mod+,", MODAL)).toEqual([])
  })

  test("returns every action that shares a binding", () => {
    const stored = JSON.stringify({ openSettings: { key: "Mod+K" } })
    const keymap = resolveKeymap(parseOverrides(stored, false))

    expect(actionsFor(keymap, "Mod+K", IDLE).map(action => action.id)).toEqual([
      "quickSwitch",
      "openSettings",
    ])
  })
})

describe("persistence", () => {
  test("round-trips overrides through storage", () => {
    const store = storage()
    const overrides = withEnabled(
      withKey({}, "quickSwitch", "Mod+P"),
      "toggleDeafen",
      false,
    )

    saveOverrides(store, overrides)

    expect(store.getItem(KEYMAP_KEY)).toBe(
      '{"quickSwitch":{"key":"Mod+P"},"toggleDeafen":{"off":true}}',
    )
    expect(loadOverrides(store, false)).toEqual(overrides)
  })

  test("starts from defaults when nothing usable is stored", () => {
    expect(loadOverrides(storage(), false)).toEqual({})
    expect(parseOverrides("not json", false)).toEqual({})
    expect(parseOverrides("[1,2]", false)).toEqual({})
    expect(parseOverrides('"text"', false)).toEqual({})
  })

  test("merges stored overrides over the defaults", () => {
    const stored = JSON.stringify({
      quickSwitch: { key: "ctrl+shift+p" },
      openSettings: { key: null },
      toggleMute: { off: true },
    })
    const keymap = resolveKeymap(parseOverrides(stored, false))

    expect(keymap.quickSwitch.key).toBe("Mod+Shift+P")
    expect(keymap.openSettings.key).toBeNull()
    expect(keymap.toggleMute).toEqual({
      key: "Mod+Shift+M",
      enabled: false,
      custom: true,
    })
    expect(keymap.nextChannel).toEqual({
      key: "Alt+ArrowDown",
      enabled: true,
      custom: false,
    })
  })

  test("drops unknown actions, invalid keys and default values", () => {
    const stored = JSON.stringify({
      removedAction: { key: "Mod+J" },
      quickSwitch: { key: "Hyper+Nothing" },
      openSettings: { key: 42, off: "yes" },
      nextChannel: { key: "Alt+ArrowDown" },
      toggleMute: "broken",
    })

    expect(parseOverrides(stored, false)).toEqual({})
  })

  test("reads Ctrl in stored bindings for the current platform", () => {
    const stored = JSON.stringify({ quickSwitch: { key: "Ctrl+P" } })

    expect(parseOverrides(stored, false)).toEqual({
      quickSwitch: { key: "Mod+P" },
    })
    expect(parseOverrides(stored, true)).toEqual({
      quickSwitch: { key: "Ctrl+P" },
    })
  })
})
