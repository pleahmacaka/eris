<script lang="ts">
  import Icon from "@iconify/svelte"
  import { erisStyle, Row, Section, SetupFlow, StandaloneTheme } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { type DefaultApp, defaultAppStatus } from "../../native"
  import type { Explorer } from "../../store/explorer.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import DefaultAppRows from "../settings/DefaultAppRows.svelte"
  import MiniExplorer from "./MiniExplorer.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  const STEPS = ["welcome", "look", "layout", "integrate", "done"]

  const FEATURES = [
    { id: "tabs", icon: "lucide:panels-top-left" },
    { id: "share", icon: "lucide:share-2" },
    { id: "terminal", icon: "lucide:square-terminal" },
  ]

  const LAYOUTS = [
    { id: "full", compact: false },
    { id: "compact", compact: true },
  ]

  let dialog = $state<HTMLDialogElement>()
  let at = $state(0)
  let handler = $state<DefaultApp>({ supported: false, enabled: false })

  const steps = $derived(
    STEPS.map(id => ({ id, label: $t(`explorer.setup.steps.${id}`) })),
  )

  const summary = $derived([
    {
      icon: "lucide:palette",
      label: $t("explorer.setup.done.look"),
      value: $t(
        erisStyle.linked && prefs.followEris
          ? "explorer.setup.done.linked"
          : "explorer.setup.done.custom",
      ),
    },
    {
      icon: "lucide:panel-top",
      label: $t("explorer.setup.done.toolbar"),
      value: $t(
        prefs.compactToolbar ? "explorer.setup.done.compact" : "explorer.setup.done.full",
      ),
    },
    {
      icon: "lucide:panel-right",
      label: $t("explorer.setup.done.preview"),
      value: $t(prefs.preview ? "explorer.setup.done.on" : "explorer.setup.done.off"),
    },
    {
      icon: "lucide:folder-check",
      label: $t("explorer.setup.done.defaultApp"),
      value: $t(handler.enabled ? "explorer.setup.done.on" : "explorer.setup.done.off"),
    },
  ])

  const finish = () => {
    prefs.setupDone = true
    explorer.setupOpen = false
  }

  $effect(() => {
    dialog?.showModal()
    defaultAppStatus()
      .then(status => (handler = status))
      .catch(() => undefined)
  })
</script>

{#snippet heading(key: string)}
  <div class="mb-4">
    <h2 class="text-2xl font-semibold tracking-tight">
      {$t(`explorer.setup.${key}.title`)}
    </h2>

    <p class="text-sm text-base-content/60">{$t(`explorer.setup.${key}.blurb`)}</p>
  </div>
{/snippet}

{#snippet preview()}
  <div class="sticky top-0 flex flex-col gap-2">
    <MiniExplorer compact={prefs.compactToolbar} preview={prefs.preview} />
  </div>
{/snippet}

<dialog
  bind:this={dialog}
  class="modal"
  oncancel={e => {
    e.preventDefault()
    finish()
  }}
>
  <div
    class="modal-box flex h-[min(42rem,92vh)] w-[min(62rem,94vw)] max-w-none flex-col overflow-hidden border border-base-content/10 bg-base-100 p-0"
  >
    <SetupFlow
      title={$t("explorer.setup.title")}
      {steps}
      bind:at
      startLabel={$t("explorer.setup.start")}
      finishLabel={$t("explorer.setup.finish")}
      onfinish={finish}
    >
      {#snippet logo()}
        <Icon icon="lucide:folder-open" class="size-5 text-primary" />
      {/snippet}

      {#snippet step(id: string)}
        {#if id === "welcome"}
          <div class="flex h-full flex-col items-center justify-center gap-8 text-center">
            <div class="flex size-16 items-center justify-center rounded-box bg-primary/15 text-primary">
              <Icon icon="lucide:folder-open" class="size-8" />
            </div>

            <div>
              <h2 class="text-3xl font-semibold tracking-tight">
                {$t("explorer.setup.welcome.title")}
              </h2>

              <p class="mt-2 text-base text-base-content/70">
                {$t("explorer.setup.welcome.tagline")}
              </p>
            </div>

            <ul class="grid w-full max-w-2xl grid-cols-3 gap-3 text-left">
              {#each FEATURES as feature (feature.id)}
                <li class="eris-card flex flex-col gap-2 p-4">
                  <div class="flex size-8 items-center justify-center rounded-field bg-primary/15 text-primary">
                    <Icon icon={feature.icon} class="size-4" />
                  </div>

                  <span class="text-sm font-semibold">
                    {$t(`explorer.setup.welcome.${feature.id}`)}
                  </span>

                  <span class="text-xs text-base-content/60">
                    {$t(`explorer.setup.welcome.${feature.id}Text`)}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {:else if id === "look"}
          {@render heading("look")}

          <div class="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6">
            <div class="flex flex-col gap-6">
              <StandaloneTheme {prefs} essential />
            </div>

            {@render preview()}
          </div>
        {:else if id === "layout"}
          {@render heading("layout")}

          <div class="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6">
            <div class="flex flex-col gap-6">
              <div role="radiogroup" class="grid grid-cols-2 gap-3">
                {#each LAYOUTS as layout (layout.id)}
                  {@const active = prefs.compactToolbar === layout.compact}

                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    class={[
                      "eris-card flex cursor-pointer flex-col gap-2 p-3 text-left",
                      active
                        ? "outline-2 outline-offset-2 outline-primary"
                        : "hover:outline-1 hover:outline-base-content/25",
                    ]}
                    onclick={() => (prefs.compactToolbar = layout.compact)}
                  >
                    <MiniExplorer compact={layout.compact} preview={false} class="shadow-none" />

                    <span class="text-sm font-semibold">
                      {$t(`explorer.setup.layout.${layout.id}`)}
                    </span>

                    <span class="text-xs text-base-content/60">
                      {$t(`explorer.setup.layout.${layout.id}Text`)}
                    </span>
                  </button>
                {/each}
              </div>

              <Section title={$t("explorer.settings.display")}>
                <Row
                  label={$t("explorer.settings.previewPane")}
                  hint={$t("explorer.settings.previewPaneHint")}
                >
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t("explorer.settings.previewPane")}
                    bind:checked={prefs.preview}
                  />
                </Row>

                <Row label={$t("explorer.settings.showHidden")}>
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t("explorer.settings.showHidden")}
                    bind:checked={prefs.showHidden}
                  />
                </Row>

                <Row label={$t("explorer.settings.showExtensions")}>
                  <input
                    type="checkbox"
                    class="toggle toggle-primary"
                    aria-label={$t("explorer.settings.showExtensions")}
                    bind:checked={prefs.showExtensions}
                  />
                </Row>
              </Section>
            </div>

            {@render preview()}
          </div>
        {:else if id === "integrate"}
          {@render heading("integrate")}

          <div class="max-w-xl">
            <Section title={$t("explorer.settings.defaultApp")}>
              <DefaultAppRows bind:handler windows={false} />
            </Section>
          </div>
        {:else}
          <div class="flex h-full flex-col items-center justify-center gap-8 text-center">
            <div class="flex size-16 items-center justify-center rounded-box bg-success/15 text-success">
              <Icon icon="lucide:check" class="size-8" />
            </div>

            <div>
              <h2 class="text-3xl font-semibold tracking-tight">
                {$t("explorer.setup.done.title")}
              </h2>

              <p class="mt-2 text-base text-base-content/70">
                {$t("explorer.setup.done.blurb")}
              </p>
            </div>

            <ul class="eris-card w-full max-w-md divide-y divide-base-content/10 text-left">
              {#each summary as entry (entry.label)}
                <li class="flex items-center gap-3 px-4 py-3">
                  <Icon icon={entry.icon} class="size-4 shrink-0 text-primary" />

                  <span class="w-32 text-sm text-base-content/60">{entry.label}</span>

                  <span class="truncate text-sm font-medium">{entry.value}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/snippet}
    </SetupFlow>
  </div>
</dialog>
