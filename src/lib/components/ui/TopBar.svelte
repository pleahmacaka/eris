<script lang="ts">
  import Icon from "@iconify/svelte"
  import { settingsNav } from "./nav"

  type Action = { icon: string; label: string; run: () => void }

  const {
    title,
    subtitle = "",
    back = null,
    actions = [],
    showSettings = true,
    wide = false,
  }: {
    title: string
    subtitle?: string
    back?: (() => void) | null
    actions?: Action[]
    showSettings?: boolean
    wide?: boolean
  } = $props()
</script>

<header
  class={[
    "pad-top sticky top-0 z-20 shrink-0",
    "border-b border-base-300/60 bg-base-100/85 backdrop-blur",
  ]}
>
  <div
    class={[
      "flex h-14 items-center gap-2 px-3",
      !wide && "mx-auto w-full max-w-3xl",
    ]}
  >
    {#if back}
      <button
        class="btn btn-ghost btn-circle btn-sm"
        aria-label="뒤로"
        onclick={back}
      >
        <Icon icon="lucide:chevron-left" class="size-5" />
      </button>
    {/if}

    <div class="min-w-0 flex-1">
      <h1 class="truncate text-lg font-semibold tracking-tight">{title}</h1>
      {#if subtitle}
        <p class="truncate text-xs text-base-content/55">{subtitle}</p>
      {/if}
    </div>

    {#each actions as action (action.label)}
      <button
        class="btn btn-ghost btn-circle btn-sm"
        aria-label={action.label}
        onclick={action.run}
      >
        <Icon icon={action.icon} class="size-5" />
      </button>
    {/each}

    {#if showSettings}
      <a
        href={settingsNav.href}
        class="btn btn-ghost btn-circle btn-sm lg:hidden"
        aria-label={settingsNav.label}
      >
        <Icon icon={settingsNav.icon} class="size-5" />
      </a>
    {/if}
  </div>
</header>
