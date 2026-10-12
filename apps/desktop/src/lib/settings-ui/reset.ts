import type { PinPath } from "@eris/settings"

export const reset =
  <T extends object>(target: () => T, defaults: T) =>
  <K extends keyof T>(key: K) =>
  () => {
    target()[key] = structuredClone(defaults[key])
  }

export const pinnableRow =
  <T extends object>(
    target: () => T,
    defaults: T,
    pin: (key: keyof T & string) => PinPath,
  ) =>
  (key: keyof T & string) => ({
    onreset: reset(target, defaults)(key),
    pin: pin(key),
  })
