import { describe, expect, mock, test } from "bun:test"

mock.module("../dock/dock.svelte", () => ({ toggleDockPin: () => undefined }))

const {
  ADMIN,
  CANCEL,
  alignApps,
  appResult,
  calcResult,
  LOCATION,
  openResult,
  pendingTimerResult,
} = await import("./providers")
const { score } = await import("./search")

type Entry = Parameters<typeof appResult>[0]

const entry = (over: Partial<Entry>): Entry => ({
  id: "1",
  name: "App",
  path: "C:\\app.lnk",
  kind: "shortcut",
  subtitle: "",
  ...over,
})

describe("alignApps", () => {
  test("taskbar pins take the id of the merged Start Menu entry", () => {
    const startMenu = entry({ id: "start", name: "Google Chrome" })
    const taskbar = entry({
      id: "taskbar",
      name: "google chrome ",
      path: "C:\\pins\\Google Chrome.lnk",
    })
    const only = entry({ id: "only", name: "Steam" })

    expect(alignApps([startMenu, only], [taskbar, only])).toEqual([
      startMenu,
      only,
    ])
  })
})

describe("appResult", () => {
  test("store apps have no file location", () => {
    const labels = (kind: Entry["kind"]) =>
      appResult(entry({ kind })).secondaryActions.map(a => a.label)

    expect(labels("shortcut")).toContain(LOCATION)
    expect(labels("store")).not.toContain(LOCATION)
    expect(labels("store")).toContain(ADMIN)
  })
})

describe("calcResult", () => {
  test("shows the error for expressions that parse but cannot be valued", () => {
    expect(calcResult("1 / 0")?.title).toBe("Division by zero")
    expect(calcResult("1 / 0")?.chips).toBeUndefined()
    expect(calcResult("2 + 2")?.title).toBe("4")
    expect(calcResult("hello")).toBeNull()
  })
})

describe("openResult", () => {
  test("ranks below an app that matches the query", () => {
    expect(openResult("https://chrome.exe").score).toBeLessThan(
      score("Google Chrome", "chrome"),
    )
  })
})

describe("pendingTimerResult", () => {
  test("Enter never cancels, the menu does", () => {
    const row = pendingTimerResult({
      id: "1",
      kind: "timer",
      label: "tea",
      fireAt: Date.now() + 60_000,
    })

    expect(row.action()).toBeUndefined()
    expect(row.secondaryActions.map(a => a.label)).toEqual([CANCEL])
  })
})
