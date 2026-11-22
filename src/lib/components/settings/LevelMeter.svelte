<script lang="ts">
const SEGMENTS = 32

const WARNING_FROM = 22

const PEAK_FROM = 28

let { level }: { level: number } = $props()

const lit = $derived(Math.round(level * SEGMENTS))

const tone = (index: number) =>
  index >= PEAK_FROM
    ? "bg-error"
    : index >= WARNING_FROM
      ? "bg-warning"
      : "bg-primary"

import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<div
  class="flex h-4 min-w-0 flex-1 items-stretch gap-0.5"
  role="meter"
  aria-label={i18n.t("settings.voice.level")}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(level * 100)}
>
  {#each { length: SEGMENTS }, index}
    <span
      class={["flex-1 rounded-sm", index < lit ? tone(index) : "bg-base-content/10"]}
    ></span>
  {/each}
</div>
