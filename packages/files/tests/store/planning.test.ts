import { describe, expect, test } from "bun:test"
import { openPlan } from "../../src/store/open-plan"
import {
  fileRenamePlan,
  placeRenameName,
  renameLanding,
} from "../../src/store/rename-plan"
import { groupKeyOf, viewPlan } from "../../src/store/view-plan"
import { item } from "./fixtures"

// Run platform-sensitive plans in fresh processes. Do not mock locations or
// replace navigator in Bun's shared test process (other suites use both).
const onPlatform = <T>(
  module: string,
  name: string,
  agent: string,
  args: unknown[][],
): T[] => {
  const url = new URL(`../../src/store/${module}.ts`, import.meta.url).href
  const script = `
    globalThis.navigator = { userAgent: ${JSON.stringify(agent)} };
    const { ${name}: plan } = await import(${JSON.stringify(url)});
    console.log(JSON.stringify(${JSON.stringify(args)}.map(args => plan(...args))));
  `
  const child = Bun.spawnSync([process.execPath, "-e", script])

  expect(child.exitCode).toBe(0)

  return JSON.parse(child.stdout.toString())
}

describe("transfer planning", () => {
  test("Windows drive/case, target, parent, nested, virtual and UNC rules", () => {
    const cases: [unknown[], unknown][] = [
      [
        [["c:\\from\\a"], "C:\\into", true],
        { into: "C:\\into", move: true, changed: ["c:\\from\\a"] },
      ],
      [
        [["C:\\from\\a", "D:\\from\\b"], "C:\\into", true],
        {
          into: "C:\\into",
          move: false,
          changed: ["C:\\from\\a", "D:\\from\\b"],
        },
      ],
      [[["c:\\INTO\\a"], "C:\\into", true], null],
      [[["C:\\from"], "c:\\FROM\\nested", true], null],
      [[["c:\\INTO\\"], "C:\\into", true], null],
      [
        [["C:\\folder"], "C:\\folder-other", true],
        { into: "C:\\folder-other", move: true, changed: ["C:\\folder"] },
      ],
      [
        [["C:\\from"], "::virtual", false, "C:\\into"],
        { into: "C:\\into", move: true, changed: ["C:\\from"] },
      ],
      [[["C:\\from"], "::virtual", false], null],
      [
        [["C:\\from"], "C:\\ignored", true, "D:\\target"],
        { into: "D:\\target", move: false, changed: ["C:\\from"] },
      ],
      [
        [["C:\\from"], "C:\\ignored", true, "::virtual"],
        { into: "::virtual", move: false, changed: ["C:\\from"] },
      ],
      [[["C:\\from"], "C:\\ignored", true, ""], null],
      [[[], "C:\\into", true], null],
      [
        [["\\\\host\\share\\a"], "\\\\HOST\\share", true],
        {
          into: "\\\\HOST\\share",
          move: false,
          changed: ["\\\\host\\share\\a"],
        },
      ],
      [[["\\\\host\\share"], "\\\\HOST\\share\\nested", true], null],
      [
        [["C:\\into\\a", "D:\\b"], "C:\\into", true],
        { into: "C:\\into", move: false, changed: ["C:\\into\\a", "D:\\b"] },
      ],
      [
        [["C:\\parent", "C:\\elsewhere\\a"], "C:\\parent\\child", true],
        {
          into: "C:\\parent\\child",
          move: true,
          changed: ["C:\\elsewhere\\a"],
        },
      ],
    ]

    expect(
      onPlatform(
        "transfer-plan",
        "transferPlan",
        "Windows",
        cases.map(([a]) => a),
      ),
    ).toEqual(cases.map(([, result]) => result))
  })

  test("non-Windows keeps case-sensitive paths and the existing move policy", () => {
    expect(
      onPlatform("transfer-plan", "transferPlan", "Linux", [
        [["/from/a", "/mount/b"], "/into", true],
        [["/into/a"], "/into", true],
        [["/from"], "/from/nested", true],
        [["/FROM"], "/from/nested", true],
        [["/from"], "::virtual", false],
      ]),
    ).toEqual([
      { into: "/into", move: true, changed: ["/from/a", "/mount/b"] },
      null,
      null,
      { into: "/from/nested", move: true, changed: ["/FROM"] },
      null,
    ])
  })
})

describe("rename naming", () => {
  test("preserves exactly the display-hidden suffix, including original case", () => {
    const file = item("/from/report.TXT")

    expect(fileRenamePlan(file, "report", "  renamed  ")).toEqual({
      name: "renamed.TXT",
    })
    expect(renameLanding(file.path, "renamed.TXT")).toBe("/from/renamed.TXT")
    expect(fileRenamePlan(file, "report.TXT", "renamed.md")?.name).toBe(
      "renamed.md",
    )
    expect(fileRenamePlan(file, "report", "renamed.md")?.name).toBe(
      "renamed.md.TXT",
    )
    expect(fileRenamePlan(file, "report", "report")).toBeNull()
    expect(fileRenamePlan(file, "report", "   ")).toBeNull()
  })

  test("directories, dotfiles and shortcuts use the supplied display name", () => {
    expect(
      fileRenamePlan(item("/a/folder.txt", { dir: true }), "folder.txt", "b")
        ?.name,
    ).toBe("b")
    expect(fileRenamePlan(item("/a/.env"), ".env", ".config")?.name).toBe(
      ".config",
    )
    expect(fileRenamePlan(item("/a/Link.URL"), "Link", "New")?.name).toBe(
      "New.URL",
    )
    expect(fileRenamePlan(item("/a/Link.lnk"), "Link", "New")?.name).toBe(
      "New.lnk",
    )
    expect(
      fileRenamePlan(item("::shell", { name: "old" }), "old", "new"),
    ).toEqual({ name: "new" })
    expect(renameLanding("::shell", "new")).toBeNull()
  })

  test("network entry suffix is only .lnk and drafts retain their own suffixes", () => {
    const place = {
      path: "\\\\host\\share",
      name: "Share",
      entry: "/places/Share.LNK",
    }

    expect(placeRenameName(place, " New ")).toBe("New.lnk")
    expect(placeRenameName(place, "New.lnk")).toBe("New.lnk.lnk")
    expect(placeRenameName(place, " Share ")).toBeNull()
    expect(placeRenameName(place, " ")).toBeNull()
    expect(
      placeRenameName({ ...place, entry: "/places/Share.url" }, "New"),
    ).toBe("New")
  })

  test("Windows landed paths use the existing join/parent rules", () => {
    expect(
      onPlatform("rename-plan", "renameLanding", "Windows", [
        ["C:\\from\\report.TXT", "renamed.TXT"],
      ]),
    ).toEqual(["C:\\from\\renamed.TXT"])
  })
})

describe("open planning", () => {
  test("directory/extraction precedence, archives, audio, models, XML and virtual shell", () => {
    expect(
      openPlan(item("/a/file.zip", { dir: true, packed: "/a.zip" }), true),
    ).toBe("navigate")
    expect(openPlan(item("/a/file.zip", { packed: "/a.zip" }), true)).toBe(
      "extract",
    )
    expect(openPlan(item("/a/file.zip"), true)).toBe("navigate")
    expect(openPlan(item("/a/file.zip"), false)).toBe("shell")
    expect(openPlan(item("/a/file.MP3"), false)).toBe("navigate")
    expect(openPlan(item("/a/file.OBJ"), false)).toBe("viewer")
    expect(openPlan(item("/a/file.XML"), false)).toBe("probeXml")
    expect(openPlan(item("shell:example", { name: "file.obj" }), false)).toBe(
      "shell",
    )
    expect(openPlan(item("::example", { name: "file.zip" }), true)).toBe(
      "shell",
    )
  })
})

describe("view planning", () => {
  const general = {
    view: "details",
    sort: "name",
    ascending: true,
    group: "none",
  } as const
  const downloads = { ...general, group: "modified" } as const
  const prefs = {
    folders: { general, downloads, pictures: general, videos: general },
    folderViews: {},
    groups: {},
  }

  test("known type, legacy group and folder-only overrides have stable precedence", () => {
    const known = [{ id: "downloads", path: "/Downloads" }] as const
    const location = "/Downloads"
    const key = groupKeyOf(location)
    const custom = { ...general, view: "large", group: "kind" } as const

    expect(viewPlan(location, false, prefs, [...known]).folder).toBe(downloads)
    expect(
      viewPlan(location, false, { ...prefs, groups: { [key]: "kind" } }, [
        ...known,
      ]).group,
    ).toBe("kind")
    const plan = viewPlan(
      location,
      false,
      {
        ...prefs,
        groups: { [key]: "modified" },
        folderViews: { [key]: custom },
      },
      [...known],
    )

    expect(plan.own).toBe(custom)
    expect(plan.folder).toBe(custom)
    expect(plan.group).toBe("kind")
    expect(plan.view).toBe("large")
    expect(groupKeyOf("/UPPER")).toBe("/upper")
  })

  test("This PC uses tiles, but an empty search result remains arrangeable", async () => {
    const { THIS_PC } = await import("../../src/locations")

    expect(viewPlan(THIS_PC, false, prefs, []).view).toBe("tiles")
    expect(viewPlan(THIS_PC, false, prefs, []).arrangeable).toBe(false)
    expect(viewPlan(THIS_PC, true, prefs, []).arrangeable).toBe(true)
  })
})
