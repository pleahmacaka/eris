import { getContext, setContext } from "svelte"
import type { ScreenId } from "#lib/landing/content.js"
import type { MockTextChannel } from "#lib/landing/mock.js"

type HomePane = "friends" | "home" | "dm"

const KEY = Symbol("mockDemo")

class MockDemo {
  screen = $state<ScreenId>("chat")
  channel = $state<MockTextChannel>("general")
  pane = $state<HomePane>("friends")
  peer = $state("")
  listOpen = $state(false)

  show(screen: ScreenId) {
    this.screen = screen
    this.listOpen = false
  }

  openChannel(channel: MockTextChannel) {
    this.channel = channel
    this.show("chat")
  }

  openVoice() {
    this.show("voice")
  }

  openPane(pane: Exclude<HomePane, "dm">) {
    this.pane = pane
    this.show("friends")
  }

  openDm(peer: string) {
    this.peer = peer
    this.pane = "dm"
    this.show("friends")
  }

  enter(place: "home" | "server") {
    this.screen = place === "home" ? "friends" : "chat"
  }

  toggleList() {
    this.listOpen = !this.listOpen
  }
}

export const provideMockDemo = () => setContext(KEY, new MockDemo())

export const useMockDemo = () => getContext<MockDemo | undefined>(KEY)
