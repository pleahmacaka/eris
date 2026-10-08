<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    defaultShell,
    PaneArea,
    popOut,
    session,
    sessionShortcut,
    setHost,
    TabStrip,
  } from "@eris/terminal"
  import { t } from "svelte-i18n"
  import { Splitter } from "@eris/ui"
  import { fail, type Explorer } from "../../store/explorer.svelte"
  import { terminal, terminalPrefs } from "../../store/terminal.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  const side = $derived(
    (terminal.position ?? terminalPrefs.position) === "side",
  )

  setHost({
    shell: () => defaultShell(terminalPrefs.shell),
    cwd: () => (explorer.filesystem ? explorer.tab.location : null),
    empty: () => (terminal.open = false),
  })

  const onkeydowncapture = (e: KeyboardEvent) => {
    if (sessionShortcut(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const resizeWidth = {
    axis: "x",
    invert: true,
    min: 16,
    max: 60,
    get: () => terminalPrefs.width,
    set: (width: number) => (terminalPrefs.width = width),
  } as const

  const resizeHeight = {
    axis: "y",
    invert: true,
    min: 6,
    max: 40,
    get: () => terminalPrefs.height,
    set: (height: number) => (terminalPrefs.height = height),
  } as const
</script>

{#if session.tabs.length > 0}
  <section
    aria-label={$t("terminal.title")}
    class={[
      "flex shrink-0 bg-base-100",
      side ? "flex-row" : "flex-col",
      !terminal.open && "hidden",
    ]}
    style:height={side ? undefined : `${terminalPrefs.height}rem`}
    style:width={side ? `${terminalPrefs.width}rem` : undefined}
    {onkeydowncapture}
  >
    <Splitter
      resize={side ? resizeWidth : resizeHeight}
      label={$t("terminal.resize")}
    />

    <div class="flex min-h-0 min-w-0 grow flex-col">
      <header class="flex h-9 shrink-0 items-stretch bg-base-300/60 select-none">
        <TabStrip />

        <div class="grow"></div>

        <button
          type="button"
          class="btn btn-ghost h-full rounded-none border-0 px-3"
          aria-label={$t(side ? "terminal.toBottom" : "terminal.toSide")}
          title={$t(side ? "terminal.toBottom" : "terminal.toSide")}
          onclick={() => (terminal.position = side ? "bottom" : "side")}
        >
          <Icon
            icon={side ? "lucide:panel-bottom" : "lucide:panel-right"}
            class="size-4"
          />
        </button>

        <button
          type="button"
          class="btn btn-ghost h-full rounded-none border-0 px-3"
          aria-label={$t("terminal.popOut")}
          title={$t("terminal.popOut")}
          onclick={() => popOut().catch(fail)}
        >
          <Icon icon="lucide:square-arrow-out-up-right" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-ghost h-full rounded-none border-0 px-3"
          aria-label={$t("terminal.close")}
          title={$t("terminal.close")}
          onclick={() => (terminal.open = false)}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </header>

      <PaneArea
        fontFamily={terminalPrefs.fontFamily}
        fontSize={13}
        visible={terminal.open}
      />
    </div>
  </section>
{/if}
