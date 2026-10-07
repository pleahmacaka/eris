<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { t } from "svelte-i18n"

  export type SetupStep = { id: string; label: string }

  let {
    title,
    steps,
    at = $bindable(0),
    busy = false,
    ready = true,
    startLabel,
    finishLabel,
    onfinish,
    onclose,
    logo,
    step,
  }: {
    title: string
    steps: SetupStep[]
    at?: number
    busy?: boolean
    ready?: boolean
    startLabel: string
    finishLabel: string
    onfinish: () => void
    onclose?: () => void
    logo?: Snippet
    step: Snippet<[string]>
  } = $props()

  const last = $derived(at === steps.length - 1)

  const next = () => {
    if (last) {
      onfinish()
    } else {
      at += 1
    }
  }

  const back = () => {
    if (at > 0) {
      at -= 1
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.defaultPrevented || busy || !ready) {
      return
    }

    const target = e.target as HTMLElement | null

    if (target?.closest("input, button, select, textarea, a")) {
      return
    }

    e.preventDefault()
    next()
  }
</script>

<svelte:window {onkeydown} />

<div class="flex h-full min-h-0 w-full flex-col">
  <header data-tauri-drag-region class="flex items-center gap-4 px-6 pt-5 pb-3">
    <div class="pointer-events-none flex items-center gap-2">
      {@render logo?.()}

      <span class="text-sm font-semibold">{title}</span>
    </div>

    <span data-tauri-drag-region class="grow"></span>

    <ol class="flex items-center gap-2" aria-label={$t("onboarding.progressAria")}>
      {#each steps as entry, index (entry.id)}
        <li class="flex">
          <button
            type="button"
            class={[
              "h-1.5 rounded-full transition-all duration-100 outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              index === at
                ? "w-6 bg-primary"
                : index < at
                  ? "w-1.5 bg-primary/50 hover:bg-primary/80"
                  : "w-1.5 bg-base-content/20 hover:bg-base-content/40",
            ]}
            aria-label={entry.label}
            aria-current={index === at ? "step" : undefined}
            disabled={busy}
            onclick={() => (at = index)}
          ></button>
        </li>
      {/each}
    </ol>

    <span data-tauri-drag-region class="grow"></span>

    <button
      type="button"
      class="btn btn-ghost btn-circle btn-sm"
      aria-label={$t("onboarding.skipSetup")}
      title={$t("onboarding.skipSetup")}
      disabled={busy}
      onclick={onclose ?? onfinish}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <section class="min-h-0 grow overflow-y-auto px-8 py-2">
    {#if ready}
      {#key at}
        <div class="step flex h-full flex-col">
          {@render step(steps[at].id)}
        </div>
      {/key}
    {:else}
      <div class="flex h-full items-center justify-center">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>
    {/if}
  </section>

  <footer class="flex items-center justify-between px-6 pt-3 pb-5">
    <button
      type="button"
      class="btn btn-ghost btn-sm"
      disabled={at === 0 || busy}
      onclick={back}
    >
      <Icon icon="lucide:arrow-left" class="size-4" />
      {$t("common.back")}
    </button>

    <div class="flex items-center gap-2">
      <span class="mr-2 hidden text-xs text-base-content/50 sm:inline">
        {$t("onboarding.enterContinues")}
      </span>

      {#if at > 0 && !last}
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          disabled={busy}
          onclick={() => (at += 1)}
        >
          {$t("common.skip")}
        </button>
      {/if}

      <button
        type="button"
        class="btn btn-primary btn-sm"
        disabled={!ready || busy}
        onclick={next}
      >
        {#if busy}
          <span class="loading loading-spinner loading-xs"></span>
        {/if}

        {at === 0 ? startLabel : last ? finishLabel : $t("common.next")}

        {#if !last && !busy}
          <Icon icon="lucide:arrow-right" class="size-4" />
        {/if}
      </button>
    </div>
  </footer>
</div>

<style>
  .step {
    animation: rise 120ms ease-out;
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
  }
</style>
