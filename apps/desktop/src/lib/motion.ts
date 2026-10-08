import {
  type AnimationFactoryArgs,
  defineTransition,
  MultiAnimation,
  type PrepareArgs,
  spring,
  WebAnimation,
} from "@ssgoi/svelte"

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

const quick = spring({ stiffness: 1100, damping: 66, restDelta: 0.01 })

const hideIncoming = async ({ to }: PrepareArgs) => {
  const incoming = await to

  incoming.style.opacity = "0"

  return {}
}

const crossfade = ({ from, to }: AnimationFactoryArgs<object>) => {
  const out = new WebAnimation({
    element: from,
    integrator: quick,
    style: (_t, u) => ({ opacity: u }),
    onComplete: () => out.releaseFill(),
  })

  const into = new WebAnimation({
    element: to,
    integrator: quick,
    style: t => ({ opacity: t, transform: `translateY(${(1 - t) * 4}px)` }),
    onComplete: () => {
      to.style.opacity = ""
      into.releaseFill()
    },
  })

  return new MultiAnimation({ out, in: into })
}

export const swap = defineTransition({
  forward: { prepare: hideIncoming, animation: crossfade },
  backward: { prepare: hideIncoming, animation: crossfade },
})

export const swapConfig = {
  transitions: [{ on: "/**", transition: swap }],
  scrollLock: false,
}
