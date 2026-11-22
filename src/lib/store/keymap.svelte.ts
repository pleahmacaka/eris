import type { ActionId } from "#lib/keymap/actions.js"
import { type Binding, bindingOf } from "#lib/keymap/binding.js"
import {
  actionsFor,
  loadOverrides,
  type Overrides,
  resolveKeymap,
  saveOverrides,
  swapKeys,
  withEnabled,
  withKey,
  withoutOverride,
} from "#lib/keymap/keymap.js"
import { isMac } from "#lib/shell/platform.js"

type Handler = () => void

type KeyHandlers = Partial<Record<ActionId, Handler>>

const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches("input, textarea, select"))

class KeymapStore {
  mac = $state(false)
  overrides = $state.raw<Overrides>({})
  keymap = $derived(resolveKeymap(this.overrides))
  customized = $derived(Object.keys(this.overrides).length > 0)

  private handlers = new Map<ActionId, Handler[]>()

  start() {
    this.mac = isMac()
    this.overrides = loadOverrides(localStorage, this.mac)
  }

  handle(handlers: KeyHandlers) {
    const entries = Object.entries(handlers) as [ActionId, Handler][]

    for (const [id, run] of entries) {
      this.handlers.set(id, [...this.handlersOf(id), run])
    }

    return () => {
      for (const [id, run] of entries) {
        this.handlers.set(
          id,
          this.handlersOf(id).filter(handler => handler !== run),
        )
      }
    }
  }

  dispatch(event: KeyboardEvent) {
    const binding = event.defaultPrevented ? null : bindingOf(event, this.mac)

    if (binding === null) {
      return
    }

    const action = actionsFor(this.keymap, binding, {
      typing: inField(event.target),
      modal: document.querySelector("dialog[open], [role='dialog']") !== null,
    }).find(candidate => this.handlersOf(candidate.id).length > 0)

    if (!action) {
      return
    }

    event.preventDefault()

    if (action.repeat || !event.repeat) {
      this.handlersOf(action.id).at(-1)?.()
    }
  }

  setKey(id: ActionId, key: Binding | null) {
    this.commit(withKey(this.overrides, id, key))
  }

  swap(id: ActionId, other: ActionId) {
    this.commit(swapKeys(this.overrides, id, other))
  }

  setEnabled(id: ActionId, enabled: boolean) {
    this.commit(withEnabled(this.overrides, id, enabled))
  }

  reset(id: ActionId) {
    this.commit(withoutOverride(this.overrides, id))
  }

  resetAll() {
    this.commit({})
  }

  private handlersOf(id: ActionId) {
    return this.handlers.get(id) ?? []
  }

  private commit(overrides: Overrides) {
    this.overrides = overrides
    saveOverrides(localStorage, overrides)
  }
}

export const keymapStore = new KeymapStore()
