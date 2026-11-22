import { ACTION_BY_ID, ACTIONS, type Action, type ActionId } from "./actions"
import { type Binding, editsText, parseBinding } from "./binding"

export const KEYMAP_KEY = "eris.keymap"

export type Override = { key?: Binding | null; off?: true }

export type Overrides = Partial<Record<ActionId, Override>>

export type Slot = { key: Binding | null; enabled: boolean; custom: boolean }

export type Keymap = Record<ActionId, Slot>

export type KeyContext = { typing: boolean; modal: boolean }

type KeymapStorage = Pick<Storage, "getItem" | "setItem">

const slotOf = (action: Action, override: Override | undefined): Slot => ({
  key: override?.key === undefined ? action.key : override.key,
  enabled: override?.off !== true,
  custom: override !== undefined,
})

export const resolveKeymap = (overrides: Overrides): Keymap =>
  Object.fromEntries(
    ACTIONS.map(action => [action.id, slotOf(action, overrides[action.id])]),
  ) as Keymap

export const withoutOverride = (
  overrides: Overrides,
  id: ActionId,
): Overrides => {
  const { [id]: _dropped, ...rest } = overrides

  return rest
}

const amend = (
  overrides: Overrides,
  id: ActionId,
  change: Override,
): Overrides => {
  const merged = { ...overrides[id], ...change }
  const override: Override = {}

  if (merged.key !== undefined && merged.key !== ACTION_BY_ID[id].key) {
    override.key = merged.key
  }

  if (merged.off) {
    override.off = true
  }

  const rest = withoutOverride(overrides, id)

  return Object.keys(override).length === 0 ? rest : { ...rest, [id]: override }
}

export const withKey = (
  overrides: Overrides,
  id: ActionId,
  key: Binding | null,
) => amend(overrides, id, { key })

export const withEnabled = (
  overrides: Overrides,
  id: ActionId,
  enabled: boolean,
) => amend(overrides, id, { off: enabled ? undefined : true })

export const swapKeys = (
  overrides: Overrides,
  id: ActionId,
  other: ActionId,
) => {
  const keymap = resolveKeymap(overrides)

  return withKey(
    withKey(overrides, other, keymap[id].key),
    id,
    keymap[other].key,
  )
}

export const conflictOf = (
  keymap: Keymap,
  id: ActionId,
  key: Binding | null,
): ActionId | null =>
  key === null
    ? null
    : (ACTIONS.find(action => action.id !== id && keymap[action.id].key === key)
        ?.id ?? null)

export const actionsFor = (
  keymap: Keymap,
  binding: Binding,
  context: KeyContext,
) =>
  ACTIONS.filter(action => {
    const slot = keymap[action.id]
    const typable = action.typing === true && !editsText(binding)

    return (
      slot.enabled &&
      slot.key === binding &&
      (typable || !context.typing) &&
      (action.global === true || !context.modal)
    )
  })

const storedKey = (value: unknown, mac: boolean) => {
  if (value === null) {
    return null
  }

  return typeof value === "string"
    ? (parseBinding(value, mac) ?? undefined)
    : undefined
}

const storedOverride = (value: unknown, mac: boolean): Override => {
  if (typeof value !== "object" || value === null) {
    return {}
  }

  const { key, off } = value as { key?: unknown; off?: unknown }

  return { key: storedKey(key, mac), off: off === true ? true : undefined }
}

export const parseOverrides = (raw: string | null, mac: boolean): Overrides => {
  let stored: unknown

  try {
    stored = JSON.parse(raw ?? "null")
  } catch {
    return {}
  }

  const record: Record<string, unknown> =
    typeof stored === "object" && stored !== null ? { ...stored } : {}

  return ACTIONS.reduce<Overrides>(
    (overrides, { id }) =>
      amend(overrides, id, storedOverride(record[id], mac)),
    {},
  )
}

export const loadOverrides = (storage: KeymapStorage, mac: boolean) =>
  parseOverrides(storage.getItem(KEYMAP_KEY), mac)

export const saveOverrides = (storage: KeymapStorage, overrides: Overrides) =>
  storage.setItem(KEYMAP_KEY, JSON.stringify(overrides))
