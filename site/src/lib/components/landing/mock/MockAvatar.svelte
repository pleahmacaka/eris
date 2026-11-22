<script lang="ts">
import type { ClassValue } from "svelte/elements"
import type { MockPresence } from "#lib/landing/mock.js"

type Size = "xs" | "sm" | "md" | "lg"

type Tone = "primary" | "neutral"

type Props = {
  name: string
  size?: Size
  tone?: Tone
  presence?: MockPresence
  ring?: ClassValue
  class?: ClassValue
}

const SIZE_CLASS: Record<Size, string> = {
  xs: "size-5 rounded-field text-2xs",
  sm: "size-7 rounded-field text-xs",
  md: "size-9 rounded-selector text-sm",
  lg: "size-12 rounded-box text-base",
}

const TONE_CLASS: Record<Tone, string> = {
  primary: "bg-primary/20 text-primary",
  neutral: "bg-base-content/10 text-base-content/80",
}

const PRESENCE_CLASS: Record<MockPresence, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-neutral",
}

let {
  name,
  size = "md",
  tone = "neutral",
  presence,
  ring = "border-base-100",
  class: className,
}: Props = $props()
</script>

<span class="relative flex shrink-0">
  <span
    class={[
      "flex items-center justify-center font-semibold",
      SIZE_CLASS[size],
      TONE_CLASS[tone],
      className,
    ]}
  >
    {name.charAt(0).toUpperCase()}
  </span>

  {#if presence}
    <span
      class={[
        "absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2",
        ring,
        PRESENCE_CLASS[presence],
      ]}
    ></span>
  {/if}
</span>
