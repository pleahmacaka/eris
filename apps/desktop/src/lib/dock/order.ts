import type { DockGroup } from "./dock.svelte"

const NO_HIDDEN = new Set<string>()

// Hiding a Windows pin unpins it only in Eris; keep its source for menu actions.
export const isDockPinned = (
  group: DockGroup,
  hidden: ReadonlySet<string> = NO_HIDDEN,
) =>
  group.pinned !== null &&
  !(group.pinned === "windows" && hidden.has(group.path))

export class DockOrdering {
  private running: string[] = []
  private saved: string[] | null = null

  commit(order: string[]) {
    const rank = new Map(order.map((path, at) => [path, at]))
    this.running.sort(
      (a, b) =>
        (rank.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
    )
    this.saved = [...order]
  }

  arrange(
    list: DockGroup[],
    order: string[],
    hidden: ReadonlySet<string> = NO_HIDDEN,
  ) {
    const pins = new Set(
      list
        .filter(group => isDockPinned(group, hidden))
        .map(group => group.path),
    )
    const running = list
      .filter(group => !pins.has(group.path))
      .map(group => group.path)
    const present = new Set(running)
    const changed =
      this.saved === null ||
      order.length !== this.saved.length ||
      order.some((path, at) => path !== this.saved?.[at])

    // Restore saved positions once. Later arrivals (including unpins/reopens)
    // append, even if the old saved order still contains their path.
    this.running =
      this.saved === null
        ? running
        : this.running.filter(path => present.has(path))
    if (changed) {
      this.commit(order)
    }
    const known = new Set(this.running)
    this.running.push(...running.filter(path => !known.has(path)))

    return orderGroups(
      list,
      order.filter(path => pins.has(path)),
      new Map(this.running.map((path, at) => [path, at])),
      hidden,
    )
  }
}

export function orderGroups(
  list: DockGroup[],
  order: string[],
  seen: ReadonlyMap<string, number>,
  hidden: ReadonlySet<string> = NO_HIDDEN,
) {
  const rank = new Map(order.map((path, index) => [path, index]))
  const sorted = [...list].sort(
    (a, b) =>
      Number(!isDockPinned(a, hidden)) - Number(!isDockPinned(b, hidden)) ||
      (rank.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.path) ?? Number.MAX_SAFE_INTEGER) ||
      (seen.get(a.path) ?? 0) - (seen.get(b.path) ?? 0),
  )
  // Windows remains the source of truth for its pins, including external moves.
  const taskbar = list.filter(
    group => group.pinned === "windows" && isDockPinned(group, hidden),
  )
  let next = 0

  return sorted.map(group =>
    group.pinned === "windows" && isDockPinned(group, hidden)
      ? taskbar[next++]
      : group,
  )
}

export type DropSlot = { path: string; midpoint: number }

export function dropTarget(
  groups: DockGroup[],
  from: string,
  slots: DropSlot[],
  x: number,
  hidden: ReadonlySet<string> = NO_HIDDEN,
) {
  const source = groups.find(group => group.path === from)

  if (!source) {
    return null
  }

  const eligible = new Set(
    groups
      .filter(
        group =>
          group.path !== from &&
          isDockPinned(group, hidden) === isDockPinned(source, hidden),
      )
      .map(group => group.path),
  )
  const candidates = slots.filter(slot => eligible.has(slot.path))
  const next = candidates.find(slot => x < slot.midpoint)
  const target = next ?? candidates.at(-1)

  return target ? { path: target.path, before: next !== undefined } : null
}

export function moveGroup(
  groups: DockGroup[],
  from: string,
  onto: string,
  before: boolean,
  hidden: ReadonlySet<string> = NO_HIDDEN,
) {
  const source = groups.find(group => group.path === from)
  const target = groups.find(group => group.path === onto)

  if (
    !source ||
    !target ||
    from === onto ||
    isDockPinned(source, hidden) !== isDockPinned(target, hidden)
  ) {
    return null
  }

  const paths = groups.map(group => group.path).filter(path => path !== from)
  const at = paths.indexOf(onto)

  paths.splice(before ? at : at + 1, 0, from)

  return paths
}
