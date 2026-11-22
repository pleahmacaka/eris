<script lang="ts">
import { onMount, untrack } from "svelte"
import QuickSwitcher from "#lib/components/keymap/QuickSwitcher.svelte"
import ShortcutSheet from "#lib/components/keymap/ShortcutSheet.svelte"
import { parseChannelsPath, SETTINGS_PATH } from "#lib/routes.js"
import { visit } from "#lib/shell/visit.js"
import { callStore } from "#lib/store/call.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { touchRecentRoom } from "#lib/switcher/switcher.js"
import { page } from "$app/state"

type Overlay = "switcher" | "shortcuts"

let overlay = $state<Overlay | null>(null)
let recent = $state.raw<string[]>([])

const signedIn = $derived(sessionStore.client !== null)

const toggle = (target: Overlay) => {
  overlay = overlay === target ? null : target
}

const close = (target: Overlay) => {
  if (overlay === target) {
    overlay = null
  }
}

const toggleMute = () =>
  void (callStore.active ? callStore.toggleMute() : groupCallStore.toggleMute())

onMount(() => keymapStore.start())

$effect(() => {
  const roomId = parseChannelsPath(page.url.pathname)?.roomId

  if (roomId) {
    recent = touchRecentRoom(
      untrack(() => recent),
      roomId,
    )
  }
})

$effect(() => {
  if (signedIn) {
    return keymapStore.handle({
      quickSwitch: () => toggle("switcher"),
      showShortcuts: () => toggle("shortcuts"),
      openSettings: () => visit(SETTINGS_PATH),
    })
  }
})

$effect(() => {
  if (callStore.active || groupCallStore.active) {
    return keymapStore.handle({ toggleMute })
  }
})

$effect(() => {
  if (groupCallStore.active) {
    return keymapStore.handle({
      toggleDeafen: () => groupCallStore.toggleDeafen(),
    })
  }
})
</script>

<svelte:window onkeydown={event => keymapStore.dispatch(event)} />

{#if signedIn}
  <QuickSwitcher
    open={overlay === "switcher"}
    {recent}
    onclose={() => close("switcher")}
  />
  <ShortcutSheet open={overlay === "shortcuts"} onclose={() => close("shortcuts")} />
{/if}
