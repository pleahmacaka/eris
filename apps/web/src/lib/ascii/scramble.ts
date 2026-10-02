import { prefersReducedMotion } from "svelte/motion"
import { randomGlyph } from "./glyphs"

const DURATION = 900

export const scramble = (node: HTMLElement) => {
  const final = node.textContent ?? ""

  if (
    prefersReducedMotion.current ||
    document.documentElement.dataset.motion === "false"
  ) {
    return
  }

  let frame = 0

  const run = () => {
    const start = performance.now()

    const tick = (now: number) => {
      const progress = (now - start) / DURATION

      node.textContent = [...final]
        .map((char, i) =>
          char === " " || progress > (i + 1) / final.length
            ? char
            : randomGlyph(),
        )
        .join("")

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        node.textContent = final
      }
    }

    frame = requestAnimationFrame(tick)
  }

  const sight = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        sight.disconnect()
        run()
      }
    },
    { threshold: 0.6 },
  )

  sight.observe(node)

  return () => {
    sight.disconnect()
    cancelAnimationFrame(frame)
    node.textContent = final
  }
}
