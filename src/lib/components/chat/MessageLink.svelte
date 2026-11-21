<script lang="ts">
import FormattedBody from "#lib/components/chat/FormattedBody.svelte"
import { type FormattedNode, plainText } from "#lib/matrix/formatted.js"
import { parseMatrixTo, type RoomTarget } from "#lib/matrix/mentions.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
import { goto } from "$app/navigation"

type Props = { href: string | null; children: FormattedNode[] }

const PILL =
  "cursor-pointer rounded-sm bg-primary/20 px-0.5 font-medium text-primary hover:bg-primary/30"

let { href, children }: Props = $props()

const target = $derived(href ? parseMatrixTo(href) : null)
const userId = $derived(target?.kind === "user" ? target.userId : null)
const room = $derived(target?.kind === "room" ? target : null)
const label = $derived(plainText(children))

const openRoom = (roomTarget: RoomTarget) => {
  const path = chatStore.roomPath(roomTarget)

  if (path) {
    void goto(path)
  }
}
</script>

{#if userId}
  <button
    type="button"
    class={PILL}
    title={userId}
    onclick={event => profileCardStore.open(userId, event.currentTarget)}
  >
    {label.startsWith("@") ? label : `@${label}`}
  </button>
{:else if room}
  <button type="button" class={PILL} onclick={() => openRoom(room)}>
    {label.startsWith("#") ? label : `#${label}`}
  </button>
{:else if href}
  <a {href} target="_blank" rel="noreferrer noopener" class="link link-primary">
    <FormattedBody nodes={children} />
  </a>
{:else}
  <FormattedBody nodes={children} />
{/if}
