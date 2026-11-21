<script lang="ts">
import type { ClassValue } from "svelte/elements"
import type { Presence } from "#lib/matrix/members.js"

type Props = { presence: Presence; size?: "sm" | "lg"; class?: ClassValue }

let { presence, size = "sm", class: className = "" }: Props = $props()

const tone = $derived(
  presence === "online"
    ? "bg-success"
    : presence === "unavailable"
      ? "bg-warning"
      : "bg-base-content/30",
)
</script>

<span
  class={[
    "absolute rounded-full",
    size === "sm"
      ? "-end-0.5 -bottom-0.5 size-3 border-2"
      : "end-0 bottom-0 size-6 border-4",
    tone,
    className,
  ]}
  aria-hidden="true"
></span>
