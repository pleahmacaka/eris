import type { SsgoiConfig } from "@ssgoi/svelte"
import { drill, fade, sheet } from "@ssgoi/svelte/view-transitions"
import { HOME_PATH, SETTINGS_PATH, SHELL_SCOPE } from "#lib/routes.js"

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches

export const motionConfig: SsgoiConfig = {
  layouts: [{ paths: SHELL_SCOPE }],
  transitions: ({ isMobile }) => {
    if (reducedMotion()) {
      return []
    }

    const everywhere = { priority: -100, on: "/**", transition: fade() }
    const settings = {
      from: SHELL_SCOPE,
      to: SETTINGS_PATH,
      transition: sheet({ type: "scale" }),
    }

    return isMobile
      ? [
          everywhere,
          {
            on: SHELL_SCOPE,
            except: [HOME_PATH, "/channels/*"],
            transition: drill(),
          },
          settings,
        ]
      : [everywhere, settings]
  },
}
