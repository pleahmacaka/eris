<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"

type Place = "home" | "server"

type Props = { t: MockCopy; home?: boolean }

let { t, home = false }: Props = $props()

const demo = useMockDemo()

const ITEM = "flex size-10 items-center justify-center font-bold"

const IDLE = "rounded-full bg-base-100 text-base-content/80"

const SELECTED = "rounded-selector bg-primary text-primary-content"

const LIVE = "cursor-pointer transition-colors hover:bg-primary/20"
</script>

{#snippet place(id: Place, label: string, selected: boolean, content: Snippet)}
  <span class="relative flex w-full justify-center">
    <span
      class={[
        "absolute start-0 top-1/2 w-1 -translate-y-1/2 rounded-e-full",
        "bg-base-content",
        selected ? "h-7" : "h-0",
      ]}
    ></span>

    {#if demo}
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        class={[ITEM, selected ? SELECTED : [IDLE, LIVE]]}
        onclick={() => demo.enter(id)}
      >
        {@render content()}
      </button>
    {:else}
      <span class={[ITEM, selected ? SELECTED : IDLE]}>
        {@render content()}
      </span>
    {/if}
  </span>
{/snippet}

{#snippet logo()}
  <Logo class="size-5" mono={home} />
{/snippet}

{#snippet initial()}
  {t.server.charAt(0)}
{/snippet}

<div
  class={[
    "w-14 shrink-0 flex-col items-center gap-2 bg-base-300 py-2",
    demo?.listOpen ? "flex" : "hidden",
    "@2xl:flex",
  ]}
>
  {@render place("home", t.nav.home, home, logo)}

  <span class="h-0.5 w-6 rounded-full bg-base-content/10"></span>

  {@render place("server", t.server, !home, initial)}

  {#each t.servers as server (server)}
    <span class={[ITEM, IDLE]}>{server.charAt(0)}</span>
  {/each}

  <span class={[ITEM, "rounded-full bg-base-100 text-success"]}>
    <Icon icon="lucide:plus" class="size-4" />
  </span>
</div>
