export const THEME_PREVIEW_KEY = "eris.themePreview"

const restore = (key: string) => {
  try {
    const theme = sessionStorage.getItem(key)

    if (theme) {
      document.documentElement.dataset.theme = theme
    }
  } catch {
    return
  }
}

export const themeRestoreScript = `(${restore})(${JSON.stringify(THEME_PREVIEW_KEY)})`
