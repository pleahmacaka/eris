<script lang="ts">
import { type Binding, bindingCaps } from "#lib/keymap/binding.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"

let { binding }: { binding: Binding } = $props()

const caps = $derived(bindingCaps(binding, keymapStore.mac))
</script>

<span class="inline-flex items-center gap-1">
  {#each caps as cap, index (index)}
    <kbd class="kbd kbd-sm">{cap}</kbd>
  {/each}
</span>
