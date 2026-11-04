<script lang="ts">
  import type { Snippet } from "svelte"
  import { escapeKey } from "../escape"
  import { write } from "../pty"
  import ClaudeChat from "./ClaudeChat.svelte"
  import { ClaudeWatch } from "./watch.svelte"

  type Props = {
    pty: number | null
    shell: string
    shown: boolean
    active: boolean
    enabled: boolean
    onfound: (found: boolean) => void
    children: Snippet<[boolean, (text: string) => void]>
  }

  let { pty, shell, shown, active, enabled, onfound, children }: Props =
    $props()

  const SUBMIT_DELAY_MS = 80

  const watch = $derived(pty === null ? null : new ClaudeWatch(pty))

  const chatting = $derived(enabled && Boolean(watch?.chat))

  const covered = $derived(chatting && !watch?.screen.overlay)

  const see = (text: string) => watch?.see(text)

  const send = (text: string) => {
    if (pty === null) {
      return
    }

    const id = pty
    const lines = text.replaceAll("\r\n", "\n").split("\n")

    write(id, lines.join("\\\r")).then(() =>
      setTimeout(() => write(id, "\r"), SUBMIT_DELAY_MS),
    )
  }

  const press = (key: string) => {
    if (pty !== null) {
      write(pty, key)
    }
  }

  $effect(() => onfound(Boolean(watch?.chat)))

  $effect(() => {
    if (watch && shown) {
      return watch.start()
    }
  })
</script>

<div class="relative size-full">
  <div class={["size-full", covered && "invisible"]}>
    {@render children(covered, see)}
  </div>

  {#if covered && watch}
    <div class="absolute inset-0 z-10">
      <ClaudeChat
        turns={watch.turns}
        results={watch.results}
        screen={watch.screen}
        commands={watch.commands}
        {active}
        onsend={send}
        onstop={() => press(escapeKey(shell))}
        onchoose={press}
      />
    </div>
  {/if}
</div>
