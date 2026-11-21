<script lang="ts" module>
const TAG_CLASS: Record<string, string> = {
  code: "rounded-sm bg-base-content/10 px-1 text-sm",
  pre: "my-1 overflow-x-auto whitespace-pre-wrap rounded-field bg-base-content/10 p-2 text-sm",
  blockquote:
    "my-1 border-base-content/20 border-s-2 ps-3 text-base-content/80",
  ul: "list-disc ps-5",
  ol: "list-decimal ps-5",
  h1: "font-bold text-xl",
  h2: "font-bold text-lg",
  h3: "font-bold",
  h4: "font-semibold",
  h5: "font-semibold",
  h6: "font-semibold",
}
</script>

<script lang="ts">
import FormattedBody from "#lib/components/chat/FormattedBody.svelte"
import MessageLink from "#lib/components/chat/MessageLink.svelte"
import type { FormattedNode } from "#lib/matrix/formatted.js"

let { nodes }: { nodes: FormattedNode[] } = $props()
</script>

{#each nodes as node}
  {#if node.type === "text"}
    {node.text}
  {:else if node.tag === "a"}
    <MessageLink href={node.href} children={node.children} />
  {:else if node.tag === "br"}
    <br />
  {:else if node.tag === "hr"}
    <hr class="my-2 border-base-content/10" />
  {:else}
    <svelte:element this={node.tag} class={TAG_CLASS[node.tag]}>
      <FormattedBody nodes={node.children} />
    </svelte:element>
  {/if}
{/each}
