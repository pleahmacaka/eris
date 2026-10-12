import { mock } from "bun:test"
import type { Item } from "../../items"
import type { CommandErrors } from "../command-errors"
import type { Tab } from "../tab.svelte"

export const item = (path: string, extra: Partial<Item> = {}): Item => ({
  key: path,
  path,
  name: path.split(/[\\/]/).at(-1) ?? path,
  dir: false,
  size: 0,
  modified: 0,
  created: 0,
  attrs: 0,
  link: false,
  kind: "",
  parent: null,
  drive: null,
  ...extra,
})

export const tab = (location: string) => ({
  location,
  items: [] as Item[],
  renaming: null as string | null,
  refresh: mock(async () => {}),
  select: mock((_keys: string[], _focus?: string | null) => {}),
  open: mock(async (..._args: Parameters<Tab["open"]>) => {}),
})

export const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })

  return { promise, resolve, reject }
}

export const errors = (): CommandErrors & { reasons: unknown[] } => {
  const reasons: unknown[] = []
  const fail = (reason: unknown) => {
    reasons.push(reason)
  }

  return {
    reasons,
    fail,
    failed: reason => {
      fail(reason)

      return null
    },
  }
}
