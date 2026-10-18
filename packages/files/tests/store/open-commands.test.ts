import { expect, mock, test } from "bun:test"
import type { Item } from "../../src/items"
import {
  type OpenServices,
  openItem,
  openSelection,
} from "../../src/store/open-commands"
import { deferred, errors, item, tab } from "./fixtures"

const services = () =>
  ({
    ...errors(),
    native: {
      extractEntry: mock(
        async (_archive: string, _entry: string) => "/temp/a.obj",
      ),
      isMujoco: mock(async (_path: string) => false),
      openViewer: mock(async (_path: string) => {}),
      openItem: mock(async (_key: string): Promise<string | null> => null),
    },
    confirmPrivate: mock(async (_path: string, _from: string) => true),
    isArchive: (name: string) => name.endsWith(".zip"),
    packedEntry: (entry: Item) =>
      entry.packed ? entry.path.slice(entry.packed.length + 1) : "",
  }) satisfies OpenServices

const contextFor = (io: OpenServices) => {
  const context = {
    tab: tab("/start"),
    selected: [] as Item[],
    navigated: [] as string[],
    go(location: string) {
      this.navigated.push(`${this.tab.location} -> ${location}`)
    },
    open(entry: Item): Promise<unknown> {
      return openItem(this, entry, io)
    },
  }

  return context
}

test("privacy denial has no dispatch or navigation", async () => {
  const io = services()
  const context = contextFor(io)

  io.confirmPrivate.mockImplementation(async () => false)
  await context.open(item("/private", { dir: true }))
  expect(context.navigated).toEqual([])
  expect(io.native.openItem).not.toHaveBeenCalled()
})

test("directory open navigates the current tab after a delayed privacy prompt", async () => {
  const io = services()
  const context = contextFor(io)
  const permission = deferred<boolean>()

  io.confirmPrivate.mockImplementation(() => permission.promise)
  const running = context.open(item("/private", { dir: true }))

  expect(io.confirmPrivate).toHaveBeenCalledWith("/private", "/start")
  context.tab = tab("/current")
  permission.resolve(true)
  await running
  expect(context.navigated).toEqual(["/current -> /private"])
})

test("extraction re-enters open with a cleared packed field and current privacy context", async () => {
  const io = services()
  const context = contextFor(io)
  const pending = deferred<string>()

  io.native.extractEntry.mockImplementation(() => pending.promise)
  const running = context.open(item("/a.zip/inner/a.obj", { packed: "/a.zip" }))

  await Promise.resolve()
  expect(io.native.extractEntry).toHaveBeenCalledWith("/a.zip", "inner/a.obj")
  context.tab = tab("/current")
  pending.resolve("/temp/a.obj")
  await running
  expect(io.confirmPrivate.mock.calls).toEqual([
    ["/a.zip/inner/a.obj", "/start"],
    ["/temp/a.obj", "/current"],
  ])
  expect(io.native.openViewer).toHaveBeenCalledWith("/temp/a.obj")
  expect(io.native.extractEntry).toHaveBeenCalledTimes(1)
})

test("extraction failure terminates; model/XML viewer failure reports; XML probe failure falls back", async () => {
  const io = services()
  const context = contextFor(io)

  io.native.extractEntry.mockImplementation(async () => {
    throw "cancelled"
  })
  await context.open(item("/a.zip/a.obj", { packed: "/a.zip" }))
  expect(io.reasons).toEqual(["cancelled"])
  expect(io.native.openViewer).not.toHaveBeenCalled()

  io.native.isMujoco.mockImplementation(async () => {
    throw "probe failure"
  })
  await context.open(item("/a.xml"))
  expect(io.native.openItem).toHaveBeenCalledWith("/a.xml")
  expect(io.reasons).toEqual(["cancelled"])

  io.native.isMujoco.mockImplementation(async () => true)
  io.native.openViewer.mockImplementation(async () => {
    throw "viewer failure"
  })
  await context.open(item("/a.xml"))
  expect(io.reasons).toEqual(["cancelled", "viewer failure"])
})

test("shell uses item keys but follows its returned folder in the current tab", async () => {
  const io = services()
  const context = contextFor(io)
  const pending = deferred<string | null>()

  io.native.openItem.mockImplementation(() => pending.promise)
  const running = context.open(item("shell:item", { key: "pidl:item" }))

  await Promise.resolve()
  expect(io.native.openItem).toHaveBeenCalledWith("pidl:item")
  context.tab = tab("/current")
  pending.resolve("/resolved")
  await running
  expect(context.navigated).toEqual(["/current -> /resolved"])
})

test("multi-open starts all files without awaiting and navigates only the first folder", () => {
  const io = services()
  const context = contextFor(io)
  const pending = deferred<unknown>()
  const open = mock((_entry: Item) => pending.promise)
  const first = item("/one", { dir: true })
  const second = item("/two", { dir: true })
  const a = item("/a")
  const b = item("/b")

  context.open = open
  context.selected = [first, a, second, b]
  expect(openSelection(context)).toBeUndefined()
  expect(open.mock.calls).toEqual([[a], [b]])
  expect(context.navigated).toEqual(["/start -> /one"])
  context.selected = [a]
  expect(openSelection(context)).toBe(pending.promise)
})
