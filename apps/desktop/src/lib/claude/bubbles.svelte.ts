import { type DeviceSettings, defaultDevice } from "@eris/settings"
import { fromStore } from "svelte/store"
import { t } from "svelte-i18n"
import type * as native from "$lib/native"
import {
  type Corner,
  clamp,
  layoutOf,
  monitorAt,
  type Point,
  sizesOf,
} from "./geometry"
import type { ClaudeSession } from "./session.svelte"
import { folderNameOf } from "./text"

export type Bubble = {
  id: string
  hue: number
  stack: string
  left: number
  top: number
  corner: Corner
  folder: string
  session: ClaudeSession | null
  unread: boolean
  title: string
  seen: number
  started: string
}

export type Mood = "idle" | "busy" | "attention" | "unread" | "other"

export const STORAGE = "eris.chat"

const TITLE_LIMIT = 40
const PREVIEW_LIMIT = 100

export class Bubbles {
  stored = JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as {
    folder?: string
    recent?: string[]
  }

  unit = $state(16)

  area = $state<native.ChatArea>({
    width: 0,
    height: 0,
    monitors: [],
    home: 0,
  })

  device = $state<DeviceSettings>(structuredClone(defaultDevice))

  bubbles = $state<Bubble[]>([])

  openId = $state<string | null>(null)

  lastId = $state<string | null>(null)

  hoverId = $state<string | null>(null)

  dragId = $state<string | null>(null)

  moved = $state(false)

  slide = $state<number[] | null>(null)

  tipWidth = $state(0)

  tipHeight = $state(0)

  panel = $state<HTMLElement>()

  placed = false

  grabX = 0

  grabY = 0

  lastX = 0

  lastY = 0

  travel = 0

  slideTimer: ReturnType<typeof setTimeout> | undefined

  protected readonly text = fromStore(t)

  sizes = $derived(sizesOf(this.unit))

  snap = $derived(this.device.chatSnap / 100)

  whole = $derived<native.ChatRect>({
    x: 0,
    y: 0,
    width: this.area.width,
    height: this.area.height,
  })

  layout = $derived(layoutOf(this.bubbles, this.sizes.step))

  current = $derived(this.bubbles.find(b => b.id === this.openId) ?? null)

  session = $derived(this.current?.session ?? null)

  open = $derived(this.current !== null)

  dragged = $derived(this.bubbles.find(b => b.id === this.dragId) ?? null)

  dragging = $derived(this.dragged !== null && this.moved)

  hovered = $derived(
    this.dragId === null
      ? (this.bubbles.find(b => b.id === this.hoverId) ?? null)
      : null,
  )

  anchor = $derived<Point>(
    this.current ? this.at(this.current) : { left: 0, top: 0 },
  )

  corner = $derived<Corner>(
    this.current ? this.cornerOf(this.current) : { right: true, bottom: true },
  )

  screen = $derived(
    this.monitorAt(
      this.anchor.left + this.sizes.bubble / 2,
      this.anchor.top + this.sizes.bubble / 2,
    ),
  )

  dragScreen = $derived(
    this.dragged
      ? this.monitorAt(
          this.dragged.left + this.sizes.bubble / 2,
          this.dragged.top + this.sizes.bubble / 2,
        )
      : this.screen,
  )

  targetX = $derived(this.dragScreen.x + this.dragScreen.width / 2)

  targetY = $derived(
    this.dragScreen.y +
      this.dragScreen.height -
      this.sizes.targetBottom -
      this.sizes.target / 2,
  )

  overTarget = $derived(
    this.dragging &&
      this.dragged !== null &&
      Math.hypot(
        this.dragged.left + this.sizes.bubble / 2 - this.targetX,
        this.dragged.top + this.sizes.bubble / 2 - this.targetY,
      ) < this.sizes.catch,
  )

  panelLeft = $derived(
    clamp(
      this.corner.right
        ? this.anchor.left - this.sizes.gap - this.sizes.panelWidth
        : this.anchor.left + this.sizes.bubble + this.sizes.gap,
      this.screen.x + this.sizes.edge,
      this.screen.x +
        this.screen.width -
        this.sizes.panelWidth -
        this.sizes.edge,
    ),
  )

  panelTop = $derived(
    clamp(
      this.corner.bottom
        ? this.anchor.top + this.sizes.bubble - this.sizes.panelHeight
        : this.anchor.top,
      this.screen.y + this.sizes.edge,
      this.screen.y +
        this.screen.height -
        this.sizes.panelHeight -
        this.sizes.edge,
    ),
  )

  origin = $derived(
    `${this.corner.right ? "right" : "left"} ${this.corner.bottom ? "bottom" : "top"}`,
  )

  panelRadius = $derived(
    this.panel
      ? Number.parseFloat(getComputedStyle(this.panel).borderTopLeftRadius)
      : this.px(1),
  )

  anyBusy = $derived(this.bubbles.some(b => b.session?.busy))

  px(rem: number) {
    return Math.round(rem * this.unit)
  }

  monitorAt(x: number, y: number) {
    return monitorAt(this.area.monitors, x, y, this.whole)
  }

  at(b: Bubble): Point {
    return this.layout.get(b.id) ?? { left: b.left, top: b.top }
  }

  headOf(stack: string) {
    return this.bubbles.find(b => b.stack === stack)
  }

  membersOf(stack: string) {
    return this.bubbles.filter(b => b.stack === stack)
  }

  heightOf(stack: string) {
    return this.membersOf(stack).length * this.sizes.step - this.sizes.stackGap
  }

  cornerOf(b: Bubble) {
    return this.headOf(b.stack)?.corner ?? b.corner
  }

  titleOf(b: Bubble) {
    if (b.title) {
      return b.title
    }

    const first = b.session?.turns.find(turn => turn.role === "user")?.blocks[0]
    const text = first?.kind === "text" ? first.text.trim().split("\n")[0] : ""

    if (text) {
      return text.slice(0, TITLE_LIMIT)
    }

    return b.folder ? folderNameOf(b.folder) : this.text.current("chat.title")
  }

  previewOf(b: Bubble) {
    const turns = b.session?.turns ?? []

    for (let i = turns.length - 1; i >= 0; i -= 1) {
      for (let j = turns[i].blocks.length - 1; j >= 0; j -= 1) {
        const block = turns[i].blocks[j]

        if (block.kind === "text" && block.text.trim()) {
          return block.text.trim().slice(0, PREVIEW_LIMIT)
        }
      }
    }

    return ""
  }

  tipOf(b: Bubble) {
    if (this.device.chatHover === "none") {
      return ""
    }

    return this.device.chatHover === "preview"
      ? this.previewOf(b) || this.titleOf(b)
      : this.titleOf(b)
  }

  moodOf(b: Bubble): Mood {
    const s = b.session

    if (s?.permission || s?.prompt) {
      return "attention"
    }

    if (s?.busy) {
      return "busy"
    }

    if (b.unread) {
      return "unread"
    }

    return this.anyBusy ? "other" : "idle"
  }

  colorOf(b: Bubble) {
    return this.device.chatBubbleColors
      ? `oklch(72% 0.15 ${b.hue})`
      : "var(--color-primary)"
  }
}
