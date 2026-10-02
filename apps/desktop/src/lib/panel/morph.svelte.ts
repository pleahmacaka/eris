import { tick } from "svelte"
import type { Attachment } from "svelte/attachments"
import * as native from "$lib/native"

const FULL_CLIP = "inset(0 round var(--radius-box))"

type Rect = [number, number, number, number]

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect()

  return [r.left, r.top, r.right, r.bottom]
}

export class Morph {
  expanded = $state(false)

  clip = $state(FULL_CLIP)

  clipPath = $derived(this.expanded ? FULL_CLIP : this.clip)

  private cards = new Set<Element>()

  private month: Element | null = null

  card: Attachment = node => {
    const observer = new ResizeObserver(this.fit)

    this.cards.add(node)
    observer.observe(node)

    return () => {
      observer.disconnect()
      this.cards.delete(node)
    }
  }

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

  fit = () => {
    if (this.expanded || this.cards.size === 0) {
      return
    }

    this.clip = this.monthClip()
    native.setWindowRegion([...this.cards].map(rectOf)).catch(() => undefined)
  }

  expand = async () => {
    if (this.expanded) {
      return
    }

    this.clip = this.monthClip()
    await native.setWindowRegion(null).catch(() => undefined)
    await tick()
    this.expanded = true
  }

  collapse = () => {
    if (!this.expanded) {
      return
    }

    this.expanded = false

    // motion off disables transitions, so no transitionend arrives to refit
    if (document.documentElement.dataset.motion === "false") {
      this.fit()
    }
  }

  settle = (e: TransitionEvent) => {
    if (e.target === e.currentTarget && e.propertyName === "clip-path") {
      this.fit()
    }
  }

  reset = async () => {
    this.expanded = false
    await tick()
    this.fit()
  }
}
