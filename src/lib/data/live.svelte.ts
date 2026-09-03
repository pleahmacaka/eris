import type { LocalItem } from "../sync/merge"
import type { Collection } from "./store"

export const live = <T extends LocalItem>(col: Collection<T>) => {
  let items = $state<T[]>([])
  let ready = $state(false)

  const stop = col.subscribe(next => {
    items = next
    ready = true
  })

  return {
    get items() {
      return items
    },
    get ready() {
      return ready
    },
    stop,
  }
}
