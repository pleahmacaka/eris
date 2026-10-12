<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { collapsed, toggleSection } from "../../store/sections.svelte"

  let {
    title,
    description,
    aside,
    children,
  }: {
    title: string
    description?: string
    aside?: Snippet
    children: Snippet
  } = $props()

  const open = $derived(!collapsed.has(title))
</script>

<section data-group={title} class="flex scroll-mt-16 flex-col gap-2">
  <header class="flex items-end justify-between gap-3 px-1">
    <h3 class="min-w-0">
      <button
        type="button"
        class="group/head flex min-w-0 cursor-pointer items-start gap-1.5 text-left"
        aria-expanded={open}
        onclick={() => toggleSection(title)}
      >
        <Icon
          icon="lucide:chevron-down"
          class={[
            "mt-0.5 size-4 shrink-0 text-base-content/40 transition-transform duration-140",
            "group-hover/head:text-base-content/70",
            !open && "-rotate-90",
          ]}
        />

        <span class="min-w-0">
          <span class="block text-sm font-semibold">{title}</span>

          {#if description}
            <span class="block text-xs font-normal text-base-content/60">{description}</span>
          {/if}
        </span>
      </button>
    </h3>

    {@render aside?.()}
  </header>

  <div
    class="grid transition-all duration-140"
    style:grid-template-rows={open ? "1fr" : "0fr"}
    inert={!open}
  >
    <div class="min-h-0 overflow-hidden">
      <div class="eris-card divide-y divide-base-content/10">
        {@render children()}
      </div>
    </div>
  </div>
</section>
