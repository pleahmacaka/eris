import { describe, expect, test } from "bun:test"
import type { DockGroup, DockPin } from "./dock.svelte"
import {
  DockOrdering,
  dropTarget,
  isDockPinned,
  moveGroup,
  orderGroups,
} from "./order"

const group = (path: string, pinned: DockPin): DockGroup => ({
  key: path,
  name: path,
  path,
  pinned,
  windows: [],
})
const paths = (groups: DockGroup[]) => groups.map(group => group.path)
const seen = (groups: DockGroup[]) =>
  new Map(groups.map((group, index) => [group.path, index]))
const slots = (groups: DockGroup[]) =>
  groups.map((group, index) => ({
    path: group.path,
    midpoint: index * 40 + 20,
  }))

describe("Dock ordering", () => {
  test("old saved orders cannot put running windows before either pin source", () => {
    const groups = [
      group("win-a", "windows"),
      group("win-b", "windows"),
      group("device", "device"),
      group("running", null),
      group("new", null),
    ]
    expect(
      paths(
        orderGroups(
          groups,
          ["running", "win-b", "device", "win-a"],
          seen(groups),
        ),
      ),
    ).toEqual(["win-a", "device", "win-b", "running", "new"])
    expect(paths(groups)).toEqual([
      "win-a",
      "win-b",
      "device",
      "running",
      "new",
    ])
  })

  test("Windows pin order follows external changes without moving running apps left", () => {
    const groups = [
      group("b", "windows"),
      group("a", "windows"),
      group("running", null),
    ]
    expect(
      paths(orderGroups(groups, ["running", "a", "b"], seen(groups))),
    ).toEqual(["b", "a", "running"])
  })

  test("new running groups append in first-seen order despite foreground changes", () => {
    const groups = [
      group("pin", "device"),
      group("a", null),
      group("b", null),
      group("new", null),
    ]
    const foregroundOrder = [groups[3], groups[0], groups[2], groups[1]]
    expect(
      paths(orderGroups(foregroundOrder, ["pin", "b"], seen(groups))),
    ).toEqual(["pin", "b", "a", "new"])
  })

  test("Windows pins unpinned only in Eris join the running suffix", () => {
    const groups = [
      group("hidden", "windows"),
      group("a", "windows"),
      group("b", "windows"),
      group("device", "device"),
      group("running", null),
    ]
    const hidden = new Set(["hidden"])
    const result = orderGroups(
      groups,
      ["hidden", "b", "device", "a", "running"],
      seen(groups),
      hidden,
    )
    expect(paths(result)).toEqual(["a", "device", "b", "hidden", "running"])
    expect(result.filter(g => isDockPinned(g, hidden)).length).toBe(3)
    expect(dropTarget(result, "hidden", slots(result), -100, hidden)).toEqual({
      path: "running",
      before: true,
    })
    expect(moveGroup(result, "hidden", "a", true, hidden)).toBeNull()
    expect(moveGroup(result, "hidden", "running", false, hidden)).toEqual([
      "a",
      "device",
      "b",
      "running",
      "hidden",
    ])
    // Its Windows source is retained so the context menu can unhide that pin.
    expect(groups[0].pinned).toBe("windows")
  })
})

describe("Dock running group lifecycle", () => {
  test("hide while running appends instead of restoring an old pin rank", () => {
    const ordering = new DockOrdering()
    const groups = [
      group("a", "windows"),
      group("b", "windows"),
      group("running", null),
    ]
    const saved = ["a", "b", "running"]
    expect(paths(ordering.arrange(groups, saved))).toEqual(saved)
    expect(paths(ordering.arrange(groups, saved, new Set(["a"])))).toEqual([
      "b",
      "running",
      "a",
    ])
  })

  test("unpin and reopen append; foreground polls never reshuffle the suffix", () => {
    const ordering = new DockOrdering()
    const pin = group("pin", "device")
    const a = group("a", null)
    const b = group("b", null)
    const saved = ["pin", "a", "b", "new"]
    ordering.arrange([pin, a, b], saved)
    const unpinned = group("pin", null)
    expect(paths(ordering.arrange([b, unpinned, a], saved))).toEqual([
      "a",
      "b",
      "pin",
    ])
    ordering.arrange([b, unpinned], saved)
    expect(
      paths(ordering.arrange([a, b, unpinned, group("new", null)], saved)),
    ).toEqual(["b", "pin", "a", "new"])
  })

  test("a saved DND change reorders live groups but not subsequent arrivals", () => {
    const ordering = new DockOrdering()
    const a = group("a", null)
    const b = group("b", null)
    ordering.arrange([a, b], ["a", "b", "new"])
    const saved = ["b", "a", "new"]
    expect(paths(ordering.arrange([a, b], saved))).toEqual(["b", "a"])
    expect(paths(ordering.arrange([group("new", null), a, b], saved))).toEqual([
      "b",
      "a",
      "new",
    ])
  })

  test("DND can restore an old saved order after a reopened group appended", () => {
    const ordering = new DockOrdering()
    const a = group("a", null)
    const b = group("b", null)
    const saved = ["a", "b"]
    ordering.arrange([a, b], saved)
    ordering.arrange([b], saved)
    const reopened = ordering.arrange([a, b], saved)
    expect(paths(reopened)).toEqual(["b", "a"])
    const moved = moveGroup(reopened, "a", "b", true)
    expect(moved).toEqual(saved)
    if (!moved) {
      return
    }
    ordering.commit(moved)
    expect(paths(ordering.arrange([a, b], moved))).toEqual(["a", "b"])
  })
})

describe("Dock drop hints and moves", () => {
  const groups = [
    group("win-a", "windows"),
    group("device", "device"),
    group("win-b", "windows"),
    group("running-a", null),
    group("running-b", null),
  ]

  test("dragged icon never becomes its own target", () => {
    expect(dropTarget(groups, "win-a", slots(groups), 10)).toEqual({
      path: "device",
      before: true,
    })
    expect(moveGroup(groups, "win-a", "win-a", false)).toBeNull()
  })

  test("cross-boundary hints clamp to the nearest legal edge", () => {
    expect(dropTarget(groups, "running-b", slots(groups), -100)).toEqual({
      path: "running-a",
      before: true,
    })
    expect(dropTarget(groups, "win-a", slots(groups), 1000)).toEqual({
      path: "win-b",
      before: false,
    })
    expect(moveGroup(groups, "running-b", "win-a", true)).toBeNull()
    expect(moveGroup(groups, "device", "running-a", false)).toBeNull()
  })

  test("a single eligible icon and unknown sources show no hint", () => {
    expect(
      dropTarget([groups[0], groups[3]], "running-a", slots(groups), 0),
    ).toBeNull()
    expect(dropTarget(groups, "missing", slots(groups), 0)).toBeNull()
    expect(moveGroup(groups, "win-a", "missing", true)).toBeNull()
  })

  test("only visible slots provide hints, including overflow boundaries", () => {
    expect(dropTarget(groups, "win-a", slots(groups).slice(0, 2), 500)).toEqual(
      {
        path: "device",
        before: false,
      },
    )
  })

  test("every hint produces the same rendered order after pin synchronization", () => {
    for (const source of groups) {
      for (const x of [-100, 0, 20, 40, 80, 100, 140, 180, 1000]) {
        const hint = dropTarget(groups, source.path, slots(groups), x)
        expect(hint).not.toBeNull()
        if (!hint) {
          continue
        }
        const moved = moveGroup(groups, source.path, hint.path, hint.before)
        expect(moved).not.toBeNull()
        if (!moved) {
          continue
        }
        // commitDrop synchronizes Windows pins before persisting the Dock order.
        const windows = groups.filter(group => group.pinned === "windows")
        windows.sort((a, b) => moved.indexOf(a.path) - moved.indexOf(b.path))
        const refreshed = [
          ...windows,
          ...groups.filter(group => group.pinned !== "windows"),
        ]
        expect(paths(orderGroups(refreshed, moved, seen(groups)))).toEqual(
          moved,
        )
      }
    }
  })
})
