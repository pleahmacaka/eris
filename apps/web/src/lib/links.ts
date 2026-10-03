export const RELEASES = "https://github.com/pleahmacaka/eris/releases/latest"
export const REPO = "https://github.com/pleahmacaka/eris"
export const ARIXLAB = "https://arixlab.com"
export const MATRIX = "https://matrix.arixlab.com"
export const THEME_SUBMIT = `${REPO}/new/main/packages/community/themes`

export const STUDIO: string | undefined =
  import.meta.env.VITE_ERIS_STUDIO ||
  (import.meta.env.DEV ? "http://localhost:1430" : undefined)
