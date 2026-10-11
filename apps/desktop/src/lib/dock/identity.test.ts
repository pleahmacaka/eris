import { expect, test } from "bun:test"
import type { AppEntry } from "../native/apps"
import type { WindowEntry } from "../native/windows"
import { fallbackPin, matchPin, windowIdentity } from "./identity"

const pin: AppEntry = {
  id: "pin",
  name: "Example",
  path: "C:\\Pins\\Example.lnk",
  kind: "shortcut",
  subtitle: "Update.exe",
  executable: "C:\\Example\\Update.exe",
  icon_executable: "C:\\Example\\app-1\\Example.exe",
  app_id: "Example.App",
}
const window: WindowEntry = {
  hwnd: 1,
  title: "Example",
  process: "C:\\Example\\app-1\\Example.exe",
  pid: 1,
  minimized: true,
}

test("explicit application identity matches a helper process", () => {
  expect(
    matchPin(pin, {
      ...window,
      process: "C:\\Other\\Helper.exe",
      app_id: "Example.App",
    }),
  ).toBe(3)
})
test("executable icon identifies helper-launched apps without an explicit window id", () => {
  expect(matchPin(pin, window)).toBe(1)
})
test("explicit conflicting ids never collapse distinct apps", () => {
  expect(matchPin(pin, { ...window, app_id: "Other.App" })).toBe(0)
})
test("case-only application id differences are not conflicting identities", () => {
  expect(matchPin(pin, { ...window, app_id: "example.APP" })).toBe(3)
  expect(
    windowIdentity({ ...window, process: "", app_id: "Example.App" }),
  ).toBe(windowIdentity({ ...window, process: "", app_id: "example.APP" }))
})
test("full paths are case-insensitive and shared basenames are not identities", () => {
  expect(matchPin(pin, { ...window, process: "c:/example/UPDATE.EXE" })).toBe(2)
  expect(matchPin(pin, { ...window, process: "C:\\Other\\Update.exe" })).toBe(0)
})
test("unknown processes remain separate instead of forming an empty group", () => {
  expect(windowIdentity({ ...window, process: "" })).not.toBe(
    windowIdentity({ ...window, process: "", hwnd: 2 }),
  )
})

test("unmatched windows with the same order path keep one executable group", () => {
  expect(windowIdentity({ ...window, app_id: "App.One" })).toBe(
    windowIdentity({ ...window, app_id: "App.Two" }),
  )
  expect(windowIdentity({ ...window, app_id: "App.One" })).toBe(
    windowIdentity({ ...window, app_id: null }),
  )
})

test("device pins missing from the app catalog retain full-path identity", () => {
  const direct = fallbackPin("C:\\Example\\app-1\\Example.exe", "Example")
  expect(direct.kind).toBe("exe")
  expect(matchPin(direct, window)).toBe(2)
  expect(
    matchPin(direct, { ...window, process: "C:\\Other\\Example.exe" }),
  ).toBe(0)
  const unknown = fallbackPin("C:\\Pins\\Example.lnk", "Example")
  expect(matchPin(unknown, window)).toBe(0)
  const store = fallbackPin("shell:AppsFolder\\Example.App", "Example")
  expect(matchPin(store, { ...window, app_id: "Example.App" })).toBe(3)
})

test("legacy fixtures match ordinary pins but native null metadata does not", () => {
  const legacy: AppEntry = {
    id: "legacy",
    name: "Example",
    path: "C:\\Pins\\Example.lnk",
    kind: "shortcut",
    subtitle: "Example.exe",
  }
  expect(matchPin(legacy, window)).toBe(1)
  expect(
    matchPin(
      { ...legacy, app_id: null, executable: null, icon_executable: null },
      window,
    ),
  ).toBe(0)
})

test("a live ancestor matches helpers within its installation tree", () => {
  const helper = {
    ...window,
    process: "C:\\Example\\bin\\Helper.exe",
    ancestor_executables: ["c:\\example\\UPDATE.EXE"],
  }
  expect(matchPin(pin, helper)).toBe(1)
  expect(matchPin(pin, { ...helper, app_id: "Other.App" })).toBe(0)
})

test("unrelated children and sibling prefix directories do not inherit launcher pins", () => {
  const child = {
    ...window,
    ancestor_executables: ["C:\\Example\\Update.exe"],
  }
  expect(matchPin(pin, { ...child, process: "C:\\Other\\Helper.exe" })).toBe(0)
  expect(
    matchPin(pin, { ...child, process: "C:\\Example-other\\Helper.exe" }),
  ).toBe(0)
  expect(
    matchPin(
      { ...pin, executable: "C:\\Launcher.exe" },
      {
        ...child,
        ancestor_executables: ["C:\\Launcher.exe"],
        process: "C:\\Other\\Helper.exe",
      },
    ),
  ).toBe(0)
})

test("an exited updater's executable argument matches the versioned application", () => {
  const discord: AppEntry = {
    id: "discord",
    name: "Discord",
    path: "C:\\Pins\\Discord.lnk",
    kind: "shortcut",
    subtitle: "Update.exe",
    app_id: "com.squirrel.Discord.Discord",
    executable: "C:\\Users\\Person\\AppData\\Local\\Discord\\Update.exe",
    icon_executable: null,
    argument_executables: ["Discord.exe"],
  }
  const running: WindowEntry = {
    ...window,
    app_id: null,
    process:
      "C:\\Users\\Person\\AppData\\Local\\Discord\\app-1.0.9261\\Discord.exe",
    ancestor_executables: [],
  }
  expect(matchPin(discord, running)).toBe(1)
  expect(matchPin(discord, { ...running, app_id: "Different.App" })).toBe(0)
  expect(
    matchPin(discord, {
      ...running,
      process: "C:\\Users\\Person\\AppData\\Local\\Discord2\\Discord.exe",
    }),
  ).toBe(0)
})

test("Steam-style helpers use live launcher ancestry even without a shortcut app id", () => {
  const steam: AppEntry = {
    id: "steam",
    name: "Steam",
    path: "C:\\Pins\\Steam.lnk",
    kind: "shortcut",
    subtitle: "Steam.exe",
    app_id: null,
    executable: "C:\\Program Files (x86)\\Steam\\Steam.exe",
    icon_executable: null,
    argument_executables: [],
  }
  const helper: WindowEntry = {
    ...window,
    app_id: "Steam",
    process: "C:\\Program Files (x86)\\Steam\\bin\\cef\\steamwebhelper.exe",
    ancestor_executables: ["C:\\Program Files (x86)\\Steam\\Steam.exe"],
  }
  expect(matchPin(steam, helper)).toBe(1)
  expect(matchPin(steam, { ...helper, ancestor_executables: [] })).toBe(0)
})
