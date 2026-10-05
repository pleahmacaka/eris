<script lang="ts">
  import type { Snippet } from "svelte"
  import Section from "$lib/components/ui/Section.svelte"

  const {
    title,
    hint = "",
    children,
    aside,
  }: {
    title: string
    hint?: string
    children: Snippet
    aside?: Snippet
  } = $props()
</script>

<Section {title} {hint} {aside}>
  <div
    class={[
      "flex flex-col divide-y divide-base-content/10 border",
      "border-base-content/10 bg-base-content/[0.02]",
    ]}
  >
    {@render children()}
  </div>
</Section>
