export const isTauri = () =>
  typeof globalThis !== "undefined" &&
  "__TAURI_INTERNALS__" in (globalThis as Record<string, unknown>)
