import { expect, mock, test } from "bun:test"
import { RECYCLE_BIN, THIS_PC } from "../../locations"
import {
  commitRename,
  type RenameServices,
  rename,
  renamePlace,
} from "../rename-commands"
import {
  changePlaces,
  emptyBin,
  more,
  newFolder,
  remove,
  type ShellServices,
} from "../shell-commands"
import { deferred, errors, item, tab } from "./fixtures"

const renameServices = () =>
  ({
    ...errors(),
    native: { renameItem: mock(async (_key: string, _name: string) => {}) },
    network: () => [],
    nameDrive: mock(() => {}),
    refreshPlaces: mock(async () => {}),
    displayName: (entry: { name: string }) => entry.name,
  }) satisfies RenameServices

const shellServices = () =>
  ({
    ...errors(),
    native: {
      newWindow: mock(async () => {}),
      deleteItems: mock(async (_keys: string[], _permanent: boolean) => {}),
      newFolder: mock(async (_location: string, _name: string) => "/start/new"),
      showProperties: mock(async () => {}),
      nativeMenu: mock(
        async (
          _keys: string[],
          _folder: string | null,
          _extended: boolean,
        ): Promise<string | null> => null,
      ),
      invokeVerb: mock(async () => {}),
      emptyRecycleBin: mock(async () => {}),
    },
    confirmAll: mock(async (_paths: string[], _from: string) => true),
    refreshPlaces: mock(async () => {}),
    pinnedKey: () => undefined,
    newFolderName: () => "New folder",
  }) satisfies ShellServices

const context = () => ({
  tab: tab("/start"),
  filesystem: true,
  inBin: false,
  selected: [item("/start/old", { key: "pidl:old" })],
  focused: null,
  rename: mock(() => {}),
})

test("file rename captures the tab and retains refresh/select-on-error behavior", async () => {
  const io = renameServices()
  const x = context()
  const started = x.tab
  const current = tab("/current")
  const pending = deferred<void>()

  started.renaming = "pidl:old"
  io.native.renameItem.mockImplementation(() => pending.promise)
  const running = commitRename(x, x.selected[0], " new ", io)

  expect(started.renaming).toBeNull()
  expect(io.native.renameItem).toHaveBeenCalledWith("pidl:old", "new")
  x.tab = current
  pending.reject("cancelled")
  await running
  expect(io.reasons).toEqual(["cancelled"])
  expect(started.refresh).toHaveBeenCalledTimes(1)
  expect(started.select).toHaveBeenCalledWith(["/start/new"])
  expect(current.refresh).not.toHaveBeenCalled()
})

test("blank/unchanged rename ends editing without IO; drive aliases are not native renames", async () => {
  const io = renameServices()
  const x = context()

  x.tab.renaming = "pidl:old"
  await commitRename(x, x.selected[0], "old", io)
  expect(x.tab.renaming).toBeNull()
  await commitRename(x, x.selected[0], " ", io)
  expect(x.tab.refresh).not.toHaveBeenCalled()
  expect(io.native.renameItem).not.toHaveBeenCalled()

  const drive = {
    path: "/",
    label: "",
    kind: "fixed" as const,
    free: 0,
    total: 0,
    remote: "",
    connected: true,
  }

  await commitRename(x, item("/", { drive }), "alias", io)
  expect(io.nameDrive).toHaveBeenCalledWith(drive, "alias")
  expect(io.native.renameItem).not.toHaveBeenCalled()
  expect(x.tab.refresh).toHaveBeenCalledTimes(1)
})

test("rename resolves the item's parent after IO, before captured-tab refresh", async () => {
  const io = renameServices()
  const x = context()
  const target = x.selected[0]
  const pending = deferred<void>()

  io.native.renameItem.mockImplementation(() => pending.promise)
  const running = commitRename(x, target, "new", io)

  target.path = "/changed/old"
  x.tab.refresh.mockImplementation(async () => {
    target.path = "/later/old"
  })
  pending.resolve()
  await running
  expect(x.tab.select).toHaveBeenCalledWith(["/changed/new"])
})

test("network rename targets its entry and refreshes places even after native failure", async () => {
  const place = { path: "/share", name: "Share", entry: "/places/Share.LNK" }
  const io = {
    ...renameServices(),
    network: () => [place],
  } satisfies RenameServices
  const x = context()

  io.native.renameItem = mock(async () => {
    throw "failure"
  })
  await commitRename(x, item("/share"), "Renamed", io)
  expect(io.native.renameItem).toHaveBeenCalledWith(
    "/places/Share.LNK",
    "Renamed.lnk",
  )
  expect(io.refreshPlaces).toHaveBeenCalledTimes(1)
  expect(x.tab.refresh).toHaveBeenCalledTimes(1)
  expect(x.tab.select).not.toHaveBeenCalled()
})

test("rename prefers focus; renamePlace opens captured tab but invokes current rename after await", async () => {
  const io = renameServices()
  const x = { ...context(), focused: item("/focused") }
  const pending = deferred<void>()

  rename(x, io)
  expect(x.tab.select).toHaveBeenCalledWith(["/focused"])
  expect(x.tab.renaming).toBe("/focused")
  x.tab.open.mockImplementation(() => pending.promise)
  const started = x.tab
  const running = renamePlace(x, "/share")

  expect(started.open).toHaveBeenCalledWith(THIS_PC, { select: "/share" })
  x.tab = tab("/current")
  pending.resolve()
  await running
  expect(x.rename).toHaveBeenCalledTimes(1)
})

test("newFolder captures its tab but uses that tab's latest location after creation", async () => {
  const io = shellServices()
  const x = context()
  const started = x.tab
  const pending = deferred<string>()

  io.native.newFolder.mockImplementation(() => pending.promise)
  const running = newFolder(x, io)

  expect(io.native.newFolder).toHaveBeenCalledWith("/start", "New folder")
  x.tab = tab("/current")
  started.location = "/navigated"
  pending.resolve("/start/new")
  await running
  expect(started.open).toHaveBeenCalledWith("/navigated", {
    record: false,
    select: "/start/new",
  })
  expect(started.renaming).toBe("/start/new")
  expect(x.tab.open).not.toHaveBeenCalled()
})

test("remove uses original selection/bin flag then refreshes current tab on error", async () => {
  const io = shellServices()
  const x = context()
  const started = x.tab
  const pending = deferred<void>()

  x.inBin = true
  io.native.deleteItems.mockImplementation(() => pending.promise)
  const running = remove(x, false, io)

  expect(io.native.deleteItems).toHaveBeenCalledWith(["pidl:old"], true)
  x.selected = [item("/other")]
  x.tab = tab("/current")
  pending.reject("cancelled")
  await running
  expect(started.refresh).not.toHaveBeenCalled()
  expect(x.tab.refresh).toHaveBeenCalledTimes(1)
})

test("shell menu privacy uses original paths but background location is read after prompt", async () => {
  const io = shellServices()
  const x = context()
  const permission = deferred<boolean>()

  io.confirmAll.mockImplementation(() => permission.promise)
  const running = more(x, [], true, io)

  expect(io.confirmAll).toHaveBeenCalledWith(["/start/old"], "/start")
  x.tab = tab("/current")
  permission.resolve(true)
  await running
  expect(io.native.nativeMenu).toHaveBeenCalledWith([], "/current", true)
  expect(x.tab.refresh).not.toHaveBeenCalled()
  expect(io.refreshPlaces).not.toHaveBeenCalled()
})

test("shell menu cancellation/error skips refresh, rename delegates, other verbs refresh", async () => {
  for (const verb of [null, "rename", "other"]) {
    const io = shellServices()
    const x = context()

    io.native.nativeMenu.mockImplementation(async () => verb)
    await more(x, ["pidl:old"], false, io)
    expect(x.rename).toHaveBeenCalledTimes(verb === "rename" ? 1 : 0)
    expect(x.tab.refresh).toHaveBeenCalledTimes(verb === "other" ? 1 : 0)
    expect(io.refreshPlaces).toHaveBeenCalledTimes(verb === "other" ? 1 : 0)
  }

  const io = shellServices()
  const x = context()

  io.native.nativeMenu.mockImplementation(async () => {
    throw "cancelled"
  })
  await more(x, [], false, io)
  expect(io.reasons).toEqual(["cancelled"])
  expect(x.tab.refresh).not.toHaveBeenCalled()
})

test("emptyBin and changePlaces inspect the current location after await", async () => {
  const io = shellServices()
  const x = context()
  const pending = deferred<void>()

  io.native.emptyRecycleBin.mockImplementation(() => pending.promise)
  const emptying = emptyBin(x, io)

  x.tab = tab(RECYCLE_BIN)
  x.inBin = true
  pending.resolve()
  await emptying
  expect(x.tab.refresh).toHaveBeenCalledTimes(1)

  const changing = deferred<unknown>()
  const running = changePlaces(x, () => changing.promise, io)

  x.tab = tab(THIS_PC)
  changing.resolve(null)
  await running
  expect(x.tab.refresh).toHaveBeenCalledTimes(1)
  expect(io.refreshPlaces).not.toHaveBeenCalled()
})
