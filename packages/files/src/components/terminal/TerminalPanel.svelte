<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Terminal } from "@eris/terminal"
  import { t } from "svelte-i18n"
  import { baseName } from "../../locations"
  import { resizeHandle } from "../../pointer"
  import type { Explorer } from "../../store/explorer.svelte"
  import {
    shellFor,
    startTerminal,
    terminal,
    terminalPrefs,
  } from "../../store/terminal.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  let pane = $state<Terminal>()

  const side = $derived(terminalPrefs.position === "side")

  const restart = () =>
    startTerminal(explorer.filesystem ? explorer.tab.location : null)

  const resizeWidth = resizeHandle({
    axis: "x",
    invert: true,
    min: 16,
    max: 60,
    get: () => terminalPrefs.width,
    set: width => (terminalPrefs.width = width),
  })

  const resizeHeight = resizeHandle({
    axis: "y",
    invert: true,
    min: 6,
    max: 40,
    get: () => terminalPrefs.height,
    set: height => (terminalPrefs.height = height),
  })
</script>

{#if terminal.session > 0}
  <section
    aria-label={$t("terminal.title")}
    class={[
      "flex shrink-0 bg-base-100",
      side ? "flex-row" : "flex-col",
      !terminal.open && "hidden",
    ]}
    style:height={side ? undefined : `${terminalPrefs.height}rem`}
    style:width={side ? `${terminalPrefs.width}rem` : undefined}
  >
    <div
      role="separator"
      aria-orientation={side ? "vertical" : "horizontal"}
      aria-label={$t("terminal.resize")}
      class={[
        "shrink-0 transition-colors hover:bg-primary/30",
        side
          ? "w-1 cursor-col-resize border-l border-base-content/10"
          : "h-1 cursor-row-resize border-t border-base-content/10",
      ]}
      onpointerdown={side ? resizeWidth : resizeHeight}
    ></div>

    <div class="flex min-h-0 min-w-0 grow flex-col">
      <header class="flex h-8 shrink-0 items-center gap-2 px-3 select-none">
        <Icon icon="lucide:square-terminal" class="size-4 shrink-0" />

        <span class="text-sm font-medium">{$t("terminal.title")}</span>

        {#if terminal.cwd}
          <span class="min-w-0 truncate text-xs text-base-content/60">
            {baseName(terminal.cwd)}
          </span>
        {/if}

        <div class="grow"></div>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("terminal.new")}
          title={$t("terminal.new")}
          onclick={restart}
        >
          <Icon icon="lucide:plus" class="size-3.5" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("terminal.kill")}
          title={$t("terminal.kill")}
          disabled={terminal.exited}
          onclick={() => pane?.kill()}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("terminal.close")}
          title={$t("terminal.close")}
          onclick={() => (terminal.open = false)}
        >
          <Icon icon="lucide:x" class="size-3.5" />
        </button>
      </header>

      <div class="relative min-h-0 grow px-3 pb-1.5">
        {#if terminal.exited}
          <div
            class="flex size-full items-center justify-center text-sm text-base-content/60"
          >
            {$t("terminal.exited")}
          </div>
        {:else}
          {#key terminal.session}
            <Terminal
              bind:this={pane}
              shell={shellFor()}
              cwd={terminal.cwd}
              fontFamily={terminalPrefs.fontFamily}
              fontSize={13}
              active={terminal.open}
              onexit={() => (terminal.exited = true)}
            />
          {/key}
        {/if}
      </div>
    </div>
  </section>
{/if}
