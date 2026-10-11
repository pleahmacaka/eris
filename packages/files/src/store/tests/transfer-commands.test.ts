import { describe, expect, mock, test } from "bun:test"
import {
  bandizip,
  clipSelection,
  copySelectionPath,
  drag,
  drop,
  paste,
  refreshLanded,
  type TransferServices,
} from "../transfer-commands"
import { deferred, errors, item, tab } from "./fixtures"

const services = () =>
  ({
    ...errors(),
    native: {
      setClipboard: mock(async (_paths: string[], _cut: boolean) => {}),
      pasteItems: mock(async (_location: string): Promise<string[]> => []),
      bandizipJob: mock(async (): Promise<string[]> => []),
      moveItems: mock(async (_paths: string[], _target: string) => {}),
      copyItems: mock(async (_paths: string[], _target: string) => {}),
      startDrag: mock(async (_keys: string[]) => {}),
    },
    writeText: mock(async (_text: string) => {}),
    confirmAll: mock(async (_paths: string[], _from: string) => true),
    archiveNotice: mock((_done: boolean) => {}),
  }) satisfies TransferServices

describe("transfer completion", () => {
  test("paste captures its tab and selects exact landed keys after refresh", async () => {
    const started = tab("/start")
    const current = tab("/current")
    const context = { tab: started, filesystem: true, selected: [] }
    const io = services()
    const pending = deferred<string[]>()

    io.native.pasteItems.mockImplementation(() => pending.promise)
    started.refresh.mockImplementation(async () => {
      started.items = [item("/start/new")]
    })

    const running = paste(context, io)

    expect(io.native.pasteItems).toHaveBeenCalledWith("/start")
    context.tab = current
    pending.resolve(["/start/new", "/start/missing", "/START/NEW"])
    await running

    expect(started.refresh).toHaveBeenCalledTimes(1)
    expect(started.select).toHaveBeenCalledWith(["/start/new"])
    expect(current.refresh).not.toHaveBeenCalled()
  })

  test("no landed matches preserves selection; refresh errors still propagate", async () => {
    const target = tab("/start")

    target.items = [item("/start/existing")]
    await refreshLanded(target, ["/start/missing"])
    expect(target.select).not.toHaveBeenCalled()

    target.refresh.mockImplementation(async () => {
      throw "refresh failure"
    })
    await expect(refreshLanded(target, ["/start/existing"])).rejects.toBe(
      "refresh failure",
    )
  })

  test("paste error/cancellation refreshes; non-filesystem paste does nothing", async () => {
    for (const reason of ["cancelled", "failure"]) {
      const target = tab("/start")
      const io = services()

      io.native.pasteItems.mockImplementation(async () => {
        throw reason
      })
      await paste({ tab: target, filesystem: true, selected: [] }, io)
      expect(io.reasons).toEqual([reason])
      expect(target.refresh).toHaveBeenCalledTimes(1)
      expect(target.select).not.toHaveBeenCalled()
    }

    const io = services()
    const target = tab("::virtual")

    await paste({ tab: target, filesystem: false, selected: [] }, io)
    expect(io.native.pasteItems).not.toHaveBeenCalled()
    expect(target.refresh).not.toHaveBeenCalled()
  })

  test("archive completion captures the tab and uses the same selection rule", async () => {
    const started = tab("/start")
    const current = tab("/current")
    const context = { tab: started, filesystem: true, selected: [] }
    const io = services()
    const pending = deferred<string[]>()

    io.native.bandizipJob.mockImplementation(() => pending.promise)
    started.refresh.mockImplementation(async () => {
      started.items = [item("/start/new")]
    })
    const running = bandizip(context, "extractHere", ["/start/a.zip"], io)

    context.tab = current
    expect(io.archiveNotice).toHaveBeenCalledWith(false)
    pending.resolve(["/start/new", "/start/missing"])
    await running
    expect(io.archiveNotice.mock.calls).toEqual([[false], [true]])
    expect(started.select).toHaveBeenCalledWith(["/start/new"])
    expect(current.refresh).not.toHaveBeenCalled()
  })

  test("archive errors do not refresh or announce success, but [] is success", async () => {
    const target = tab("/start")
    const context = { tab: target, filesystem: true, selected: [] }
    const io = services()

    io.native.bandizipJob.mockImplementation(async () => {
      throw "cancelled"
    })
    await bandizip(context, "extractHere", [], io)
    expect(target.refresh).not.toHaveBeenCalled()
    expect(io.archiveNotice.mock.calls).toEqual([[false]])
    expect(io.reasons).toEqual(["cancelled"])

    io.native.bandizipJob.mockImplementation(async () => [])
    await bandizip(context, "extractHere", [], io)
    expect(target.refresh).toHaveBeenCalledTimes(1)
    expect(target.select).not.toHaveBeenCalled()
    expect(io.archiveNotice.mock.calls).toEqual([[false], [false], [true]])
  })
})

describe("live-tab transfer commands", () => {
  test("drop keeps its planned destination but refreshes the current tab on failure", async () => {
    const started = tab("/start")
    const current = tab("/current")
    const context = { tab: started, filesystem: true, selected: [] }
    const io = services()
    const pending = deferred<void>()

    io.native.moveItems.mockImplementation(() => pending.promise)
    const running = drop(context, ["/from/a"], null, io)

    expect(io.native.moveItems).toHaveBeenCalledWith(["/from/a"], "/start")
    context.tab = current
    pending.reject("cancelled")
    await running
    expect(io.reasons).toEqual(["cancelled"])
    expect(current.refresh).toHaveBeenCalledTimes(1)
    expect(started.refresh).not.toHaveBeenCalled()
  })

  test("drag captures keys/paths before privacy, then refreshes the current tab", async () => {
    const started = tab("/start")
    const current = tab("/current")
    const selected = item("/private/a", { key: "pidl:a" })
    const context = { tab: started, filesystem: true, selected: [selected] }
    const io = services()
    const permission = deferred<boolean>()
    const pending = deferred<void>()

    io.confirmAll.mockImplementation(() => permission.promise)
    io.native.startDrag.mockImplementation(() => pending.promise)
    const running = drag(context, io)

    expect(io.confirmAll).toHaveBeenCalledWith(["/private/a"], "/start")
    context.selected = [item("/other")]
    context.tab = current
    permission.resolve(true)
    await Promise.resolve()
    expect(io.native.startDrag).toHaveBeenCalledWith(["pidl:a"])
    pending.resolve()
    await running
    expect(current.refresh).toHaveBeenCalledTimes(1)
    expect(started.refresh).not.toHaveBeenCalled()
  })

  test("privacy refusal does not start drag or refresh", async () => {
    const target = tab("/start")
    const io = services()

    io.confirmAll.mockImplementation(async () => false)
    await drag(
      { tab: target, filesystem: true, selected: [item("/private")] },
      io,
    )
    expect(io.native.startDrag).not.toHaveBeenCalled()
    expect(target.refresh).not.toHaveBeenCalled()
  })

  test("clipboard keeps paths distinct from shell keys and quoted CRLF text", async () => {
    const context = {
      tab: tab("/start"),
      filesystem: true,
      selected: [item("/a", { key: "pidl:a" }), item("/b", { key: "pidl:b" })],
    }
    const io = services()

    await clipSelection(context, true, io)
    copySelectionPath(context, io)
    expect(io.native.setClipboard).toHaveBeenCalledWith(["/a", "/b"], true)
    expect(io.writeText).toHaveBeenCalledWith('"/a"\r\n"/b"')
  })
})
