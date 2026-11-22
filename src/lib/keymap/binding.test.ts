import { describe, expect, test } from "bun:test"
import {
  bindingCaps,
  bindingOf,
  editsText,
  type KeyStroke,
  parseBinding,
} from "./binding"

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

describe("parseBinding", () => {
  test("orders modifiers and upper-cases letters", () => {
    expect(parseBinding("shift+ctrl+m", false)).toBe("Mod+Shift+M")
    expect(parseBinding(" Alt + Ctrl + k ", false)).toBe("Mod+Alt+K")
  })

  test("maps Ctrl and Cmd onto Mod for the platform", () => {
    expect(parseBinding("Ctrl+K", false)).toBe("Mod+K")
    expect(parseBinding("Ctrl+K", true)).toBe("Ctrl+K")
    expect(parseBinding("Cmd+K", true)).toBe("Mod+K")
    expect(parseBinding("Cmd+K", false)).toBe("Meta+K")
    expect(parseBinding("CmdOrCtrl+K", false)).toBe("Mod+K")
    expect(parseBinding("CmdOrCtrl+K", true)).toBe("Mod+K")
    expect(parseBinding("Option+Shift+Up", true)).toBe("Alt+Shift+ArrowUp")
  })

  test("accepts key names, aliases and punctuation", () => {
    expect(parseBinding("esc", false)).toBe("Escape")
    expect(parseBinding("alt+down", false)).toBe("Alt+ArrowDown")
    expect(parseBinding("pagedown", false)).toBe("PageDown")
    expect(parseBinding("Ctrl+,", false)).toBe("Mod+,")
    expect(parseBinding("Ctrl+/", false)).toBe("Mod+/")
    expect(parseBinding("Ctrl+Plus", false)).toBe("Mod+Plus")
    expect(parseBinding("ctrl+space", false)).toBe("Mod+Space")
    expect(parseBinding("f5", false)).toBe("F5")
  })

  test("keeps a canonical binding unchanged", () => {
    for (const binding of ["Mod+Alt+Shift+ArrowUp", "Shift+Escape", "/"]) {
      expect(parseBinding(binding, false)).toBe(binding)
      expect(parseBinding(binding, true)).toBe(binding)
    }
  })

  test("rejects malformed bindings", () => {
    for (const text of [
      "",
      "Ctrl+",
      "Ctrl++",
      "Hyper+K",
      "Ctrl+Shift",
      "Ctrl+F25",
      "Ctrl+ㅏ",
      "Ctrl+Process",
    ]) {
      expect(parseBinding(text, false)).toBeNull()
    }
  })
})

describe("bindingOf", () => {
  test("reads Ctrl as Mod on Windows and Linux", () => {
    const event = stroke("k", "KeyK", { ctrlKey: true })

    expect(bindingOf(event, false)).toBe("Mod+K")
    expect(bindingOf(event, true)).toBe("Ctrl+K")
  })

  test("reads Cmd as Mod on macOS", () => {
    const event = stroke("k", "KeyK", { metaKey: true })

    expect(bindingOf(event, true)).toBe("Mod+K")
    expect(bindingOf(event, false)).toBe("Meta+K")
  })

  test("orders held modifiers", () => {
    const event = stroke("ArrowUp", "ArrowUp", {
      shiftKey: true,
      altKey: true,
      ctrlKey: true,
    })

    expect(bindingOf(event, false)).toBe("Mod+Alt+Shift+ArrowUp")
  })

  test("falls back to the physical key for non-Latin layouts", () => {
    expect(bindingOf(stroke("ㅏ", "KeyK", { metaKey: true }), true)).toBe(
      "Mod+K",
    )
    expect(bindingOf(stroke("л", "KeyK", { ctrlKey: true }), false)).toBe(
      "Mod+K",
    )
    expect(bindingOf(stroke("˚", "KeyK", { altKey: true }), true)).toBe("Alt+K")
    expect(bindingOf(stroke("÷", "Slash", { altKey: true }), true)).toBe(
      "Alt+/",
    )
  })

  test("names shifted punctuation by its key, not its symbol", () => {
    expect(
      bindingOf(stroke("?", "Slash", { ctrlKey: true, shiftKey: true }), false),
    ).toBe("Mod+Shift+/")
    expect(bindingOf(stroke("!", "Digit1", { shiftKey: true }), false)).toBe(
      "Shift+1",
    )
    expect(bindingOf(stroke("K", "KeyK", { shiftKey: true }), false)).toBe(
      "Shift+K",
    )
  })

  test("keeps unshifted characters and named keys", () => {
    expect(bindingOf(stroke(",", "Comma", { ctrlKey: true }), false)).toBe(
      "Mod+,",
    )
    expect(bindingOf(stroke("/", "Slash"), false)).toBe("/")
    expect(bindingOf(stroke(" ", "Space"), false)).toBe("Space")
    expect(bindingOf(stroke("+", "NumpadAdd"), false)).toBe("Plus")
    expect(bindingOf(stroke("Escape", "Escape"), false)).toBe("Escape")
    expect(bindingOf(stroke("PageUp", "PageUp"), false)).toBe("PageUp")
    expect(bindingOf(stroke("F5", "F5"), false)).toBe("F5")
  })

  test("ignores every key pressed during IME composition", () => {
    expect(
      bindingOf(
        stroke("k", "KeyK", { ctrlKey: true, isComposing: true }),
        false,
      ),
    ).toBeNull()
    expect(
      bindingOf(stroke("Process", "KeyK", { keyCode: 229 }), false),
    ).toBeNull()
    expect(
      bindingOf(stroke("Escape", "Escape", { keyCode: 229 }), false),
    ).toBeNull()
    expect(
      bindingOf(stroke("Enter", "Enter", { isComposing: true }), false),
    ).toBeNull()
  })

  test("ignores modifier and input-mode keys pressed alone", () => {
    for (const key of [
      "Control",
      "Shift",
      "Alt",
      "Meta",
      "HangulMode",
      "Dead",
    ]) {
      expect(bindingOf(stroke(key, ""), false)).toBeNull()
    }
  })

  test("ignores AltGr typing", () => {
    const event = stroke("@", "KeyQ", {
      ctrlKey: true,
      altKey: true,
      getModifierState: name => name === "AltGraph",
    })

    expect(bindingOf(event, false)).toBeNull()
  })
})

describe("bindingCaps", () => {
  test("uses key names on Windows and Linux", () => {
    expect(bindingCaps("Mod+Shift+M", false)).toEqual(["Ctrl", "Shift", "M"])
    expect(bindingCaps("Meta+K", false)).toEqual(["Win", "K"])
  })

  test("uses symbols in the Apple order on macOS", () => {
    expect(bindingCaps("Mod+K", true)).toEqual(["⌘", "K"])
    expect(bindingCaps("Mod+Alt+Shift+ArrowUp", true)).toEqual([
      "⌥",
      "⇧",
      "⌘",
      "↑",
    ])
    expect(bindingCaps("Mod+Shift+M", true)).toEqual(["⇧", "⌘", "M"])
    expect(bindingCaps("Ctrl+Alt+K", true)).toEqual(["⌃", "⌥", "K"])
  })

  test("labels arrows, escape and paging keys", () => {
    expect(bindingCaps("Alt+ArrowDown", false)).toEqual(["Alt", "↓"])
    expect(bindingCaps("Shift+Escape", false)).toEqual(["Shift", "Esc"])
    expect(bindingCaps("PageDown", false)).toEqual(["Page Down"])
    expect(bindingCaps("Mod+Plus", false)).toEqual(["Ctrl", "+"])
  })
})

describe("editsText", () => {
  test("flags keys that type or move the caret", () => {
    for (const binding of [
      "A",
      "Shift+A",
      "/",
      "Enter",
      "Shift+Tab",
      "Space",
    ]) {
      expect(editsText(binding)).toBe(true)
    }
  })

  test("clears chords and keys a text field does not use", () => {
    for (const binding of [
      "Mod+A",
      "Alt+ArrowUp",
      "Escape",
      "Shift+Escape",
      "PageUp",
      "F2",
    ]) {
      expect(editsText(binding)).toBe(false)
    }
  })
})
