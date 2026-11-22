<script lang="ts">
import Icon from "@iconify/svelte"

let { label }: { label: string } = $props()
</script>

<p
  class={[
    "flex items-center justify-between gap-2 px-2 pt-3 pb-1 font-semibold",
    "text-2xs text-base-content/60",
  ]}
>
  <span class="truncate">{label}</span>
  <Icon icon="lucide:plus" class="size-3.5 shrink-0" />
</p>
