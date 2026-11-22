<script lang="ts">
import Icon from "@iconify/svelte"

type Props = { icon: string; title: string; hint: string }

let { icon, title, hint }: Props = $props()
</script>

<div
  class={[
    "flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4",
    "text-center",
  ]}
>
  <Icon {icon} class="mb-1 size-8 text-base-content/40" />
  <p class="font-semibold">{title}</p>
  <p class="max-w-xs text-xs text-base-content/70">{hint}</p>
</div>
