import {
  clampWidth,
  loadWidth,
  SIDEBARS,
  type Sidebar,
  saveWidth,
} from "#lib/shell/sidebar.js"

export type Screen = "home" | "chat"

class LayoutStore {
  narrow = $state(false)
  screen = $state<Screen>("home")
  membersOpen = $state(true)
  membersSheet = $state(false)
  widths = $state<Record<Sidebar, number>>({
    channels: SIDEBARS.channels.initial,
    members: SIDEBARS.members.initial,
  })

  watch() {
    const query = matchMedia("(width < 48rem)")
    const apply = () => {
      this.narrow = query.matches

      if (!query.matches) {
        this.membersSheet = false
      }
    }

    apply()
    this.widths = {
      channels: loadWidth(localStorage, "channels"),
      members: loadWidth(localStorage, "members"),
    }
    query.addEventListener("change", apply)

    return () => query.removeEventListener("change", apply)
  }

  openChat() {
    this.screen = "chat"
  }

  back() {
    this.screen = "home"
    this.membersSheet = false
  }

  settle(side: Sidebar, width: number) {
    this.widths[side] = clampWidth(side, width)
  }

  resize(side: Sidebar, width: number, limit: number) {
    this.widths[side] = clampWidth(side, width, limit)
  }

  commitWidths() {
    saveWidth(localStorage, "channels", this.widths.channels)
    saveWidth(localStorage, "members", this.widths.members)
  }

  resetWidth(side: Sidebar) {
    this.widths[side] = SIDEBARS[side].initial
    this.commitWidths()
  }

  toggleMembers() {
    if (this.narrow) {
      this.membersSheet = !this.membersSheet
    } else {
      this.membersOpen = !this.membersOpen
    }
  }
}

export const layoutStore = new LayoutStore()
