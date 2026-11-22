export type Binding = string

export type KeyStroke = {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
  isComposing: boolean
  keyCode: number
  getModifierState: (key: string) => boolean
}

const MODIFIERS = ["Mod", "Ctrl", "Alt", "Shift", "Meta"] as const

type Modifier = (typeof MODIFIERS)[number]

const MAC_ORDER: Modifier[] = ["Ctrl", "Alt", "Shift", "Mod", "Meta"]

const MAC_LABELS: Record<Modifier, string> = {
  Mod: "⌘",
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Meta: "⌘",
}

const PC_LABELS: Record<Modifier, string> = {
  Mod: "Ctrl",
  Ctrl: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Meta: "Win",
}

const NAMED_KEYS = [
  "Escape",
  "Enter",
  "Tab",
  "Space",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Plus",
]

const TEXT_SAFE_KEYS = ["Escape", "PageUp", "PageDown"]

const KEY_NAMES = new Map([
  ...NAMED_KEYS.map(name => [name.toLowerCase(), name] as const),
  [" ", "Space"],
  ["+", "Plus"],
  ["esc", "Escape"],
  ["return", "Enter"],
  ["del", "Delete"],
  ["up", "ArrowUp"],
  ["down", "ArrowDown"],
  ["left", "ArrowLeft"],
  ["right", "ArrowRight"],
])

const KEY_LABELS = new Map([
  ["ArrowUp", "↑"],
  ["ArrowDown", "↓"],
  ["ArrowLeft", "←"],
  ["ArrowRight", "→"],
  ["Escape", "Esc"],
  ["PageUp", "Page Up"],
  ["PageDown", "Page Down"],
  ["Plus", "+"],
])

const CODE_KEYS = new Map([
  ["Backquote", "`"],
  ["Minus", "-"],
  ["Equal", "="],
  ["BracketLeft", "["],
  ["BracketRight", "]"],
  ["Backslash", "\\"],
  ["Semicolon", ";"],
  ["Quote", "'"],
  ["Comma", ","],
  ["Period", "."],
  ["Slash", "/"],
])

const isLetter = (char: string) =>
  (char >= "a" && char <= "z") || (char >= "A" && char <= "Z")

const isPrintable = (char: string) => char > " " && char <= "~"

const charKey = (char: string) => {
  if (isLetter(char)) {
    return char.toUpperCase()
  }

  return isPrintable(char) ? char : null
}

const functionKey = (name: string) => {
  const index = Number(name.slice(1))
  const valid =
    name.charAt(0).toUpperCase() === "F" &&
    Number.isInteger(index) &&
    index >= 1 &&
    index <= 24

  return valid ? `F${index}` : null
}

const keyOf = (name: string) =>
  KEY_NAMES.get(name.toLowerCase()) ??
  (name.length === 1 ? charKey(name) : functionKey(name))

const modifierOf = (name: string, mac: boolean): Modifier | null => {
  switch (name.toLowerCase()) {
    case "mod":
    case "cmdorctrl":
      return "Mod"
    case "ctrl":
    case "control":
      return mac ? "Ctrl" : "Mod"
    case "cmd":
    case "command":
    case "meta":
    case "win":
    case "super":
      return mac ? "Mod" : "Meta"
    case "alt":
    case "option":
      return "Alt"
    case "shift":
      return "Shift"
    default:
      return null
  }
}

const compose = (held: Modifier[], key: string): Binding =>
  [...MODIFIERS.filter(modifier => held.includes(modifier)), key].join("+")

const parts = (binding: Binding) => {
  const names = binding.split("+")

  return {
    held: names.slice(0, -1) as Modifier[],
    key: names[names.length - 1],
  }
}

export const parseBinding = (text: string, mac: boolean): Binding | null => {
  const names = text.split("+").map(name => name.trim())
  const key = keyOf(names[names.length - 1])
  const held = names.slice(0, -1).map(name => modifierOf(name, mac))

  return key === null || held.includes(null)
    ? null
    : compose(
        held.filter(modifier => modifier !== null),
        key,
      )
}

const codeKey = (code: string) => {
  if (code.length === 4 && code.startsWith("Key")) {
    return code.charAt(3)
  }

  if (code.length === 6 && code.startsWith("Digit")) {
    return code.charAt(5)
  }

  return CODE_KEYS.get(code) ?? null
}

const strokeKey = ({ key, code, shiftKey }: KeyStroke) => {
  const byPosition =
    key.length === 1 &&
    key !== " " &&
    !isLetter(key) &&
    (shiftKey || !isPrintable(key))

  return byPosition ? codeKey(code) : keyOf(key)
}

export const bindingOf = (stroke: KeyStroke, mac: boolean): Binding | null => {
  // the keydown that starts an IME composition reports isComposing false; only keyCode 229 marks it
  const composing = stroke.isComposing || stroke.keyCode === 229
  // AltGr typing (@, {, € on European layouts) arrives as Ctrl+Alt
  const typing = stroke.getModifierState("AltGraph")
  const key = composing || typing ? null : strokeKey(stroke)

  if (key === null) {
    return null
  }

  const held: [Modifier, boolean][] = [
    ["Mod", mac ? stroke.metaKey : stroke.ctrlKey],
    ["Ctrl", mac && stroke.ctrlKey],
    ["Alt", stroke.altKey],
    ["Shift", stroke.shiftKey],
    ["Meta", !mac && stroke.metaKey],
  ]

  return compose(
    held.filter(([, down]) => down).map(([modifier]) => modifier),
    key,
  )
}

export const bindingCaps = (binding: Binding, mac: boolean): string[] => {
  const { held, key } = parts(binding)
  const modifiers = mac
    ? MAC_ORDER.filter(modifier => held.includes(modifier)).map(
        modifier => MAC_LABELS[modifier],
      )
    : held.map(modifier => PC_LABELS[modifier])

  return [...modifiers, KEY_LABELS.get(key) ?? key]
}

export const editsText = (binding: Binding) => {
  const { held, key } = parts(binding)

  return (
    held.every(modifier => modifier === "Shift") &&
    !TEXT_SAFE_KEYS.includes(key) &&
    functionKey(key) === null
  )
}
