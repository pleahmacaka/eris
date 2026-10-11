import { expect, test } from "bun:test"
import { apps, readAppConfig } from "../../../scripts/apps"
import { discover, evaluate } from "../../../scripts/cdp"

// Opt-in: this drives the running dev WebView, not a browser or IPC mock.
test.skipIf(process.env.ERIS_DEV_UI_TESTS !== "1")(
  "settings transitions never retain outgoing navigation or query its groups",
  async () => {
    const config = await readAppConfig("desktop")
    const port = apps.desktop.port
    const targets = await discover({
      port,
      origin: new URL(config.build.devUrl).origin,
    })
    const target = targets.find(t => new URL(t.url).pathname === "/settings")
    if (!target) {
      throw new Error("Open settings in bun run dev before running UI tests.")
    }

    const result = (await evaluate(
      target.webSocketDebuggerUrl,
      port,
      `(async () => {
        const selector = "[data-settings-section]";
        const initial = document.querySelector(selector + '[aria-current="page"]');
        const frame = () => new Promise(requestAnimationFrame);
        const violations = [];
        let samples = 0;
        let overlappingFrames = 0;
        const click = id => {
          const button = document.querySelector(selector + '[data-settings-section="' + id + '"]');
          if (!button) throw new Error("Missing settings tab: " + id);
          button.click();
        };
        try {
          // Revisit the same page while its outgoing snapshot is still present.
          for (const id of ["general", "dock", "appearance", "dock", "general", "calendar", "note", "general"]) {
            click(id);
            for (let i = 0; i < 8; i++) {
              await frame();
              samples++;
              const pages = [...document.querySelectorAll("[data-ssgoi-transition]")];
              if (pages.length > 1) overlappingFrames++;
              const current = pages.find(p =>
                p.dataset.ssgoiTransition === "/settings/" + id &&
                p.style.position !== "absolute"
              );
              const navs = [...document.querySelectorAll("nav")].filter(n => !n.querySelector(selector));
              if (pages.some(p => p.querySelector("nav")) || navs.length > 1) {
                violations.push("Outgoing navigation retained: " + id);
              }
              if (!current) {
                violations.push("Current page missing: " + id);
                continue;
              }
              const groups = [...current.querySelectorAll("section[data-group]")].map(e => e.dataset.group);
              const expected = groups.length > 1 ? groups : [];
              const actual = navs.flatMap(n => [...n.querySelectorAll("button")].map(b => b.textContent.trim()));
              if (JSON.stringify(expected) !== JSON.stringify(actual)) {
                violations.push("Stale table of contents: " + id);
              }
            }
          }
          const current = document.querySelector('[data-ssgoi-transition="/settings/general"]:not([style*="position: absolute"])');
          const nav = [...document.querySelectorAll("nav")].find(n => !n.querySelector(selector));
          const buttons = [...(nav?.querySelectorAll("button") ?? [])];
          const last = buttons.at(-1);
          if (!last || !current) throw new Error("Missing general-page groups");
          last.click();
          await frame();
          const active = nav.querySelector('[aria-current="true"]')?.textContent.trim();
          if (active !== last.textContent.trim()) violations.push("Group jump targeted outgoing page");
          return { samples, overlappingFrames, violations };
        } finally {
          if (initial) click(initial.dataset.settingsSection);
        }
      })()`,
    )) as {
      samples: number
      overlappingFrames: number
      violations: string[]
    }
    expect(result.samples).toBe(64)
    expect(result.overlappingFrames).toBeGreaterThan(0)
    expect(result.violations).toEqual([])
  },
)
