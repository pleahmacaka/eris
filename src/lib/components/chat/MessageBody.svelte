<script lang="ts">
import FormattedBody from "#lib/components/chat/FormattedBody.svelte"
import MessageAttachment from "#lib/components/chat/MessageAttachment.svelte"
import { parseFormattedBody } from "#lib/matrix/formatted.js"
import type { ChatMessage } from "#lib/matrix/timeline.js"

let { item }: { item: ChatMessage } = $props()

const source = $derived(item.formattedBody)
const nodes = $derived(source === null ? null : parseFormattedBody(source))
</script>

{#if item.attachment}
  <MessageAttachment attachment={item.attachment} />
{:else if nodes}
  <div class="break-words text-md">
    <FormattedBody {nodes} />
  </div>
{:else}
  <p class="whitespace-pre-wrap break-words text-md">{item.body}</p>
{/if}
