import { prefersReducedMotion } from "svelte/motion"

export const QUICK_MS = 140

export const SHEET_MS = 180

export const SHAPE_MS = 180

export const duration = (ms: number) => (prefersReducedMotion.current ? 0 : ms)

export const softEnter = () => ({
  y: 4,
  opacity: 0.6,
  duration: duration(QUICK_MS),
})
