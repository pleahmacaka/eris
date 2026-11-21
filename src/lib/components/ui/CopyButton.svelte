<script lang="ts">
import Icon from "@iconify/svelte"

const COPIED_MS = 1500

let { text, label }: { text: string; label: string } = $props()

let copied = $state(false)
let timer: ReturnType<typeof setTimeout> | undefined

const title = $derived(copied ? i18n.t("ui.copied") : label)

const copy = async () => {
  await navigator.clipboard.writeText(text)
  copied = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied = false
  }, COPIED_MS)
}

$effect(() => () => clearTimeout(timer))

import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<button
  type="button"
  class="btn btn-ghost btn-square btn-xs shrink-0"
  aria-label={title}
  {title}
  onclick={copy}
>
  <Icon
    icon={copied ? "lucide:check" : "lucide:copy"}
    class={["size-3.5", copied && "text-success"]}
  />
</button>
