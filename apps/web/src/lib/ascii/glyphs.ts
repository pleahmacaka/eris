export const RAMP = " .:-=+*#%@"

export const NOISE = "ERIS01#%*+=:"

export const CELL_ASPECT = 1.9

export const FONT_FAMILY = '"Pretendard Variable", Pretendard, sans-serif'

export const randomGlyph = () =>
  NOISE[Math.floor(Math.random() * NOISE.length)] ?? "#"

export const glyphFont = (size: number) => `600 ${size}px ${FONT_FAMILY}`

export const loadGlyphFont = () =>
  document.fonts.load(glyphFont(16), RAMP + NOISE).catch(() => [])

export const cssColor = (el: Element, variable: string) =>
  getComputedStyle(el).getPropertyValue(variable).trim()
