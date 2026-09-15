const FADE_MS = 120

export const fadeShell = (out: boolean) => {
  const el = document.querySelector<HTMLElement>(".siri-shell")

  if (!el || document.documentElement.dataset.motion === "false") {
    return
  }

  for (const animation of el.getAnimations()) {
    animation.cancel()
  }

  const base = Number.parseFloat(getComputedStyle(el).opacity) || 1

  el.animate([{ opacity: out ? base : 0 }, { opacity: out ? 0 : base }], {
    duration: FADE_MS,
    easing: out ? "ease-in" : "ease-out",
    fill: out ? "forwards" : "backwards",
  })
}
