import { describe, expect, test } from "bun:test"
import { type AppName, apps, readAppConfig, requireWindows } from "./apps"
import { assertPortAvailable, devPlan, parseDevArgs } from "./dev-lib"

describe("dev runner", () => {
  test("defaults to desktop and forwards Tauri and Cargo arguments", async () => {
    const options = parseDevArgs([
      "--headless",
      "--no-watch",
      "--",
      "--headless",
    ])
    expect(options).toEqual({
      app: "desktop",
      headless: true,
      args: ["--no-watch", "--", "--headless"],
    })
    const plan = await devPlan(options, "win32", {})
    expect(plan.command.slice(0, 7)).toEqual([
      "bun",
      "run",
      "--cwd",
      "apps/desktop",
      "tauri",
      "dev",
      "--no-watch",
    ])
    expect(plan.command.slice(-2)).toEqual(["--", "--headless"])
    expect(plan.env.ERIS_DEV_HEADLESS).toBe("1")
  })

  test("headless hides every configured window and preserves its other fields", async () => {
    for (const app of Object.keys(apps) as AppName[]) {
      const config = await readAppConfig(app)
      const plan = await devPlan(parseDevArgs([app, "--headless"]), "win32", {})
      const override = JSON.parse(
        plan.command[plan.command.indexOf("--config") + 1],
      )
      expect(override.app.windows).toEqual(
        config.app.windows.map(window => ({
          ...window,
          additionalBrowserArgs: expect.stringContaining(
            `--remote-debugging-port=${apps[app].port}`,
          ),
          visible: false,
          focus: false,
        })),
      )
      expect(plan.env.ERIS_DEV_HEADLESS).toBe("1")
    }
  })

  for (const app of Object.keys(apps) as AppName[]) {
    test(`${app} has isolated config and child-only debugging environment`, async () => {
      const inherited = {
        ERIS_DEV_HEADLESS: "1",
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:
          "--disable-gpu --remote-debugging-port=9999 --remote-debugging-address=0.0.0.0",
        KEEP: "yes",
      }
      const plan = await devPlan(parseDevArgs([app]), "win32", inherited)
      const override = JSON.parse(
        plan.command[plan.command.indexOf("--config") + 1],
      )
      expect(override.identifier.endsWith(".dev")).toBe(true)
      expect(override.productName.endsWith(" Dev")).toBe(true)
      expect(override.plugins["deep-link"].desktop.schemes).toEqual(
        apps[app].schemes,
      )
      for (const window of override.app.windows) {
        expect(window.additionalBrowserArgs).toEndWith(
          `--remote-debugging-port=${apps[app].port} --remote-debugging-address=127.0.0.1`,
        )
      }
      expect(plan.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS).toEndWith(
        ` --disable-gpu --remote-debugging-port=${apps[app].port} --remote-debugging-address=127.0.0.1`,
      )
      expect(plan.env.ERIS_DEV_HEADLESS).toBeUndefined()
      expect(plan.env.KEEP).toBe("yes")
      expect(inherited.ERIS_DEV_HEADLESS).toBe("1")
      expect(inherited.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS).toContain("9999")
    })
  }

  test("normal non-Windows dev works, headless and debug fail clearly", async () => {
    const plan = await devPlan(parseDevArgs([]), "linux", {})
    expect(plan.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS).toBeUndefined()
    await expect(
      devPlan(parseDevArgs(["--headless"]), "linux", {}),
    ).rejects.toThrow("require Windows")
    expect(() => requireWindows("darwin")).toThrow("require Windows")
  })

  test("invalid app fails before launching", () => {
    expect(() => parseDevArgs(["other"])).toThrow("Unknown app")
  })

  test("release and custom profiles cannot bypass development guards", async () => {
    for (const arg of ["--release", "--profile", "--profile=custom"]) {
      await expect(devPlan(parseDevArgs([arg]), "win32", {})).rejects.toThrow(
        "default debug profile",
      )
      await expect(
        devPlan(parseDevArgs(["--", arg]), "win32", {}),
      ).rejects.toThrow("default debug profile")
    }
    await expect(
      devPlan(parseDevArgs([]), "win32", {
        CARGO_PROFILE_DEV_DEBUG_ASSERTIONS: "false",
      }),
    ).rejects.toThrow("debug assertions")
  })

  test("occupied port fails rather than attaching", async () => {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response("not Eris"),
    })
    try {
      await expect(
        assertPortAvailable("terminal", server.port),
      ).rejects.toThrow("refusing to attach")
    } finally {
      server.stop(true)
    }
  })
})
