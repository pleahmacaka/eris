import { calm, rem } from "./motion"

const FALLBACK = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]

type ScrambleOptions = {
  delay?: number
  duration?: number
  onView?: boolean
}

type Scramble = { destroy(): void }

const played = new Set<string>()

const resting = () => calm() || document.visibilityState === "hidden"

export function scramble(
  node: HTMLElement,
  options: ScrambleOptions = {},
): Scramble | undefined {
  const target = node.textContent ?? ""

  if (target.trim().length === 0 || played.has(target) || resting()) {
    return
  }

  if (options.onView) {
    let run: Scramble | undefined

    const seen = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) {
          return
        }

        seen.disconnect()
        run = scramble(node, { ...options, onView: false })
      },
      { rootMargin: "0% 0% -12% 0%" },
    )

    seen.observe(node)

    return {
      destroy() {
        seen.disconnect()
        run?.destroy()
      },
    }
  }

  const { delay = 0, duration = 640 } = options

  played.add(target)
  const letters = [...target]
  const unique = [...new Set(letters.filter(char => char.trim().length > 0))]
  const pool = unique.length >= 6 ? unique : FALLBACK
  const box = node.getBoundingClientRect()
  const unit = rem(1)

  let frame = 0
  let started = 0

  const pick = () => pool[Math.floor(Math.random() * pool.length)]

  const settle = () => {
    cancelAnimationFrame(frame)
    node.textContent = target
    node.style.width = ""
    node.style.height = ""
    node.style.overflow = ""
    node.removeAttribute("aria-label")
  }

  const draw = (progress: number) => {
    const locked = progress * letters.length

    node.textContent = letters
      .map((char, index) =>
        char.trim().length === 0 || index < locked ? char : pick(),
      )
      .join("")
  }

  const step = (now: number) => {
    started ||= now

    const progress = Math.min(1, (now - started) / duration)

    draw(progress)

    if (progress < 1) {
      frame = requestAnimationFrame(step)

      return
    }

    settle()
  }

  node.setAttribute("aria-label", target)
  node.style.width = `${box.width / unit}rem`
  node.style.height = `${box.height / unit}rem`
  node.style.overflow = "hidden"
  draw(0)

  const begin = setTimeout(() => {
    frame = requestAnimationFrame(step)
  }, delay)

  const rescue = setTimeout(settle, delay + duration + 400)

  return {
    destroy() {
      clearTimeout(begin)
      clearTimeout(rescue)
      settle()
    },
  }
}
