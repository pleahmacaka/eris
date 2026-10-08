import { flushSync } from "svelte"
import type { Attachment } from "svelte/attachments"
import * as native from "$lib/native"

const FULL_CLIP = "inset(0 round var(--radius-box))"

const SETTLE_FALLBACK = 600

type Rect = [number, number, number, number]

// enter and exit animations slide cards with transform, so the region tracks where a card comes to rest
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect()
  const { m41: x, m42: y } = new DOMMatrixReadOnly(
    getComputedStyle(el).transform,
  )

  return [
    Math.round(r.left - x),
    Math.round(r.top - y),
    Math.round(r.right - x),
    Math.round(r.bottom - y),
  ]
}

const motionOff = () => document.documentElement.dataset.motion === "false"

export class Morph {
  expanded = $state(false)

  clip = $state(FULL_CLIP)

  clipPath = $derived(this.expanded ? FULL_CLIP : this.clip)

  private moving = false

  private settleTimer: ReturnType<typeof setTimeout> | undefined

  private compact = new Set<Element>()

  private full = new Set<Element>()

  private month: Element | null = null

  private region = ""

  private surface =
    (cards: Set<Element>): Attachment =>
    node => {
      const observer = new ResizeObserver(this.fit)
      const moved = (e: Event) => e.target === node && this.fit()

      cards.add(node)
      observer.observe(node)
      node.addEventListener("transitionend", moved)

      return () => {
        observer.disconnect()
        node.removeEventListener("transitionend", moved)
        cards.delete(node)
        this.fit()
      }
    }

  card = this.surface(this.compact)

  fullCard = this.surface(this.full)

  monthCard: Attachment = node => {
    this.month = node

    const release = this.card(node)

    return () => {
      release?.()

      if (this.month === node) {
        this.month = null
      }
    }
  }

  private monthClip = () => {
    if (!this.month) {
      return FULL_CLIP
    }

    const [left, top, right, bottom] = rectOf(this.month)

    return `inset(${top}px ${innerWidth - right}px ${innerHeight - bottom}px ${left}px round var(--radius-box))`
  }

  // the window region also clips painting, so it must cover both layouts while one morphs into the other
  fit = () => {
    if (!this.expanded) {
      this.clip = this.monthClip()
    }

    const cards = this.moving
      ? [...this.compact, ...this.full]
      : [...(this.expanded ? this.full : this.compact)]

    const rects = cards.map(rectOf)
    const region = JSON.stringify(rects)

    if (rects.length > 0 && region !== this.region) {
      this.region = region
      native.setWindowRegion(rects).catch(() => undefined)
    }
  }

  private settled = () => {
    clearTimeout(this.settleTimer)
    this.moving = false
    this.fit()
  }

  private move = (expanded: boolean) => {
    if (this.expanded === expanded) {
      return
    }

    this.clip = this.monthClip()
    this.moving = !motionOff()
    this.expanded = expanded
    this.fit()

    if (this.moving) {
      clearTimeout(this.settleTimer)
      this.settleTimer = setTimeout(this.settled, SETTLE_FALLBACK)
    }
  }

  expand = () => this.move(true)

  collapse = () => this.move(false)

  settle = (e: TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === "clip-path") {
      this.settled()
    }
  }

  snap = (expanded: boolean, apply: () => void = () => undefined) => {
    const root = document.documentElement
    const motion = root.dataset.motion

    root.dataset.motion = "false"
    flushSync(() => {
      apply()
      this.expanded = expanded
    })
    root.getBoundingClientRect()

    if (motion === undefined) {
      delete root.dataset.motion
    } else {
      root.dataset.motion = motion
    }

    this.settled()
  }
}
