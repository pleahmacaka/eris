import type { Message } from "#lib/i18n/translate.js"

export type MenuItem = {
  id: string
  label: Message
  icon: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

export type MenuSection = MenuItem[]

export type MenuRow =
  | { kind: "item"; item: MenuItem; index: number }
  | { kind: "separator"; key: string }

export const menuRows = (sections: MenuSection[]): MenuRow[] => {
  const rows: MenuRow[] = []
  let index = 0

  for (const section of sections) {
    if (section.length > 0 && index > 0) {
      rows.push({ kind: "separator", key: `separator-${index}` })
    }

    for (const item of section) {
      rows.push({ kind: "item", item, index })
      index += 1
    }
  }

  return rows
}

export const stepItem = (items: MenuItem[], from: number, step: 1 | -1) => {
  const count = items.length
  const start = from < 0 && step === -1 ? count : from

  for (let offset = 1; offset <= count; offset += 1) {
    const index = (((start + step * offset) % count) + count) % count

    if (!items[index]?.disabled) {
      return index
    }
  }

  return -1
}

const NAVIGATION = new Map<string, { edge: boolean; step: 1 | -1 }>([
  ["ArrowDown", { edge: false, step: 1 }],
  ["ArrowUp", { edge: false, step: -1 }],
  ["Home", { edge: true, step: 1 }],
  ["PageUp", { edge: true, step: 1 }],
  ["End", { edge: true, step: -1 }],
  ["PageDown", { edge: true, step: -1 }],
])

export const navigate = (items: MenuItem[], active: number, key: string) => {
  const move = NAVIGATION.get(key)

  return move ? stepItem(items, move.edge ? -1 : active, move.step) : null
}
