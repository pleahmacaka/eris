export const reset =
  <T extends object>(target: () => T, defaults: T) =>
  <K extends keyof T>(key: K) =>
  () => {
    target()[key] = structuredClone(defaults[key])
  }
