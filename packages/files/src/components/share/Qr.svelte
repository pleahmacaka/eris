<script lang="ts">
  import { qr } from "./share"

  let { text, label }: { text: string; label: string } = $props()

  let svg = $state("")

  $effect(() => {
    qr(text)
      .then(value => {
        svg = value
      })
      .catch(() => {
        svg = ""
      })
  })
</script>

<div
  class="size-44 shrink-0 rounded-box bg-white p-1.5 *:size-full"
  role="img"
  aria-label={label}
>
  {@html svg}
</div>
