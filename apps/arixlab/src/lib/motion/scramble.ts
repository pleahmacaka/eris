const FALLBACK = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches

type Scramble = { destroy(): void }

type ScrambleOptions = {
  delay?: number
  duration?: number
  onView?: boolean
}

export function scramble(
  node: HTMLElement,
  options: ScrambleOptions = {},
): Scramble | undefined {
  const target = node.textContent ?? ""

  if (target.trim().length === 0 || reduced()) {
    return
  }

  if (options.onView) {
    let run: Scramble | undefined

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) {
          return
        }

        observer.disconnect()
        run = scramble(node, { ...options, onView: false })
      },
      { rootMargin: "0px 0px -12% 0px" },
    )

    observer.observe(node)

    return {
      destroy() {
        observer.disconnect()
        run?.destroy()
      },
    }
  }

  const { delay = 0, duration = 640 } = options
  const letters = [...target]
  const unique = [...new Set(letters.filter(c => c.trim().length > 0))]
  const pool = unique.length >= 6 ? unique : FALLBACK

  let raf = 0
  let started = 0

  const pick = () => pool[Math.floor(Math.random() * pool.length)]

  const box = node.getBoundingClientRect()

  const lock = () => {
    node.style.width = `${box.width}px`
    node.style.height = `${box.height}px`
    node.style.overflow = "hidden"
  }

  const settle = () => {
    cancelAnimationFrame(raf)
    node.textContent = target
    node.style.width = ""
    node.style.height = ""
    node.style.overflow = ""
  }

  const draw = (progress: number) => {
    const locked = progress * letters.length

    node.textContent = letters
      .map((char, i) =>
        char.trim().length === 0 || i < locked ? char : pick(),
      )
      .join("")
  }

  const step = (now: number) => {
    started ||= now

    const progress = Math.min(1, (now - started) / duration)

    draw(progress)

    if (progress < 1) {
      raf = requestAnimationFrame(step)
      return
    }

    settle()
  }

  lock()
  draw(0)

  const start = setTimeout(() => {
    raf = requestAnimationFrame(step)
  }, delay)

  const rescue = setTimeout(settle, delay + duration + 400)

  return {
    destroy() {
      clearTimeout(start)
      clearTimeout(rescue)
      settle()
    },
  }
}
