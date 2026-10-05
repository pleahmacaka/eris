const FALLBACK = 16

export const rem = (multiple: number) => {
  if (typeof document === "undefined") {
    return multiple * FALLBACK
  }

  const root = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  )

  return multiple * (Number.isFinite(root) && root > 0 ? root : FALLBACK)
}

export const calm = () =>
  typeof document === "undefined" ||
  matchMedia("(prefers-reduced-motion: reduce)").matches
