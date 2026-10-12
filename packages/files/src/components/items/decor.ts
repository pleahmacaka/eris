import type { GitState } from "../../git"
import type { CleanupColor } from "../../store/prefs.svelte"

export const DUPLICATE_TINTS = [
  "bg-sky-400/15 hover:bg-sky-400/25",
  "bg-emerald-400/15 hover:bg-emerald-400/25",
  "bg-violet-400/15 hover:bg-violet-400/25",
  "bg-pink-400/15 hover:bg-pink-400/25",
  "bg-lime-400/15 hover:bg-lime-400/25",
  "bg-indigo-400/15 hover:bg-indigo-400/25",
]

export const GIT_TONES: Record<GitState, string> = {
  ignored: "text-base-content/40",
  untracked: "text-info",
  staged: "text-success",
  modified: "text-warning",
  conflict: "text-error",
}

export const CLEANUP_COLORS: {
  id: CleanupColor
  badge: string
  swatch: string
}[] = [
  {
    id: "orange",
    badge: "bg-orange-500/15 text-orange-500",
    swatch: "bg-orange-500",
  },
  { id: "amber", badge: "bg-warning/15 text-warning", swatch: "bg-warning" },
  { id: "red", badge: "bg-error/15 text-error", swatch: "bg-error" },
  { id: "primary", badge: "bg-primary/15 text-primary", swatch: "bg-primary" },
]

export const cleanupBadge = (color: CleanupColor) =>
  CLEANUP_COLORS.find(entry => entry.id === color)?.badge ??
  CLEANUP_COLORS[0].badge
