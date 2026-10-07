<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { t } from "svelte-i18n"

  export type PrefsPage = {
    id: string
    label: string
    icon: string
    group?: string
  }

  let {
    title,
    pages,
    page = $bindable(),
    onclose,
    nav,
    children,
  }: {
    title: string
    pages: PrefsPage[]
    page: string
    onclose?: () => void
    nav?: Snippet
    children: Snippet
  } = $props()

  let scroller = $state<HTMLElement>()

  const current = $derived(pages.find(entry => entry.id === page))

  $effect(() => {
    void page
    scroller?.scrollTo({ top: 0 })
  })
</script>

<div class="@container h-full min-h-0 w-full">
  <div class="flex h-full min-h-0 flex-col @3xl:flex-row">
    <nav
      aria-label={title}
      class={[
        "flex shrink-0 gap-0.5 overflow-x-auto border-b border-base-content/10 bg-base-200/40 px-2.5 py-2",
        "@3xl:w-56 @3xl:flex-col @3xl:overflow-x-visible @3xl:overflow-y-auto @3xl:border-r @3xl:border-b-0 @3xl:pt-3 @3xl:pb-4",
      ]}
    >
      <h2 class="hidden px-3 pt-1 pb-3 text-base font-semibold @3xl:block">{title}</h2>

      {@render nav?.()}

      {#each pages as entry, index (entry.id)}
        {#if entry.group && entry.group !== pages[index - 1]?.group}
          <p class="hidden px-3 pt-4 pb-1 text-xs font-semibold text-base-content/50 @3xl:block">
            {entry.group}
          </p>
        {/if}

        <button
          type="button"
          class={[
            "flex shrink-0 items-center gap-3 rounded-field px-3 py-2 text-left text-sm",
            "outline-none transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-primary/50",
            entry.id === page
              ? "bg-base-content/10 font-semibold"
              : "text-base-content/80 hover:bg-base-content/5",
          ]}
          aria-current={entry.id === page ? "page" : undefined}
          onclick={() => (page = entry.id)}
        >
          <Icon icon={entry.icon} class="size-4 shrink-0" />
          <span class="truncate">{entry.label}</span>
        </button>
      {/each}
    </nav>

    <div class="flex min-h-0 min-w-0 grow flex-col">
      <header class="relative flex h-12 shrink-0 items-center justify-center px-12">
        <h3 class="truncate text-sm font-semibold">{current?.label ?? ""}</h3>

        {#if onclose}
          <button
            type="button"
            class="btn btn-ghost btn-circle btn-sm absolute right-2"
            aria-label={$t("common.close")}
            onclick={onclose}
          >
            <Icon icon="lucide:x" class="size-4" />
          </button>
        {/if}
      </header>

      <div bind:this={scroller} class="min-h-0 grow overflow-y-auto">
        <div class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2 pb-8 @lg:px-6">
          {@render children()}
        </div>
      </div>
    </div>
  </div>
</div>
