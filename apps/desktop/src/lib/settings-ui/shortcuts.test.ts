import { expect, test } from "bun:test"
import en from "@eris/i18n/en.json"
import { chips, shortcuts } from "./shortcuts"

const t = (key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string

test("launcher group lists the win key and the shortcut chips", () => {
  const device = {
    launcherTrigger: "both" as const,
    launcherShortcut: "Super+Space",
    chatShortcut: "Ctrl+Space",
  }

  const launcher = shortcuts(t, device)[0]
  const openers = launcher.items.filter(
    i => i.action === t("settings.shortcuts.openLauncher"),
  )

  expect(chips("Super+Space")).toEqual(["Win", "Space"])
  expect(openers.map(i => i.keys)).toEqual([["Win"], ["Win", "Space"]])
  expect(
    shortcuts(t, { ...device, launcherTrigger: "win" })[0].items[0].keys,
  ).toEqual(["Win"])
  expect(
    shortcuts(t, { ...device, launcherTrigger: "win" })[0].items[1].action,
  ).toBe(t("settings.shortcuts.moveSelection"))
})
