export const RELEASES = "https://github.com/pleahmacaka/eris/releases/latest"
export const REPO = "https://github.com/pleahmacaka/eris"
export const ARIXLAB = "https://arixlab.com"
export const NOTE = "https://arixlab.com/note"
export const STUDIO: string =
  import.meta.env.VITE_ERIS_STUDIO ||
  (import.meta.env.DEV ? "http://localhost:1430/" : "/studio/")
