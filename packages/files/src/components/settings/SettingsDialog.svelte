<script lang="ts">
  import { DesktopAccount } from "@eris/auth/tauri"
  import { getVersion } from "@tauri-apps/api/app"
  import {
    Confirm,
    type PrefsPage,
    PrefsWindow,
    Row,
    Section,
    StandaloneTheme,
  } from "@eris/ui"
  import { locale, t } from "svelte-i18n"
  import TranscribeSettings from "../audio/TranscribeSettings.svelte"
  import DeviceSettings from "../share/DeviceSettings.svelte"
  import TerminalSettings from "../terminal/TerminalSettings.svelte"
  import DefaultAppRows from "./DefaultAppRows.svelte"
  import SidebarSettings from "./SidebarSettings.svelte"
  import type { Explorer } from "../../store/explorer.svelte"
  import { prefs, resetPrefs } from "../../store/prefs.svelte"

  type Toggle =
    | "showHidden"
    | "showExtensions"
    | "preview"
    | "selectionInMore"
    | "compactToolbar"

  let {
    open = $bindable(false),
    standalone = false,
    explorer,
  }: { open?: boolean; standalone?: boolean; explorer: Explorer } = $props()

  const PAGES: [string, string][] = [
    ["general", "lucide:settings-2"],
    ["appearance", "lucide:palette"],
    ["sidebar", "lucide:panel-left"],
    ["defaultApp", "lucide:folder-check"],
    ["terminal", "lucide:square-terminal"],
    ["transcribe", "lucide:audio-lines"],
    ["devices", "lucide:share-2"],
    ["account", "lucide:circle-user-round"],
    ["about", "lucide:info"],
  ]

  let dialog = $state<HTMLDialogElement>()
  let page = $state("general")
  let version = $state("")
  let resetting = $state(false)

  const pages = $derived<PrefsPage[]>(
    PAGES.map(([id, icon]) => ({
      id,
      icon,
      label: $t(`explorer.settings.pages.${id}`),
    })),
  )

  $effect(() => {
    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
      getVersion().then(value => (version = value))
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })

  const rerunSetup = () => {
    open = false
    explorer.setupOpen = true
  }
</script>

{#snippet switchRow(key: Toggle, label: string, hint?: string)}
  <Row {label} {hint}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={label}
      bind:checked={prefs[key]}
    />
  </Row>
{/snippet}

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
  <div
    class="modal-box h-[min(44rem,90vh)] w-[min(64rem,94vw)] max-w-none overflow-hidden border border-base-content/10 bg-base-100 p-0"
  >
    <PrefsWindow
      title={$t("explorer.settings.title")}
      {pages}
      bind:page
      onclose={() => (open = false)}
    >
      {#if page === "general"}
        <Section title={$t("explorer.settings.display")}>
          {@render switchRow("showHidden", $t("explorer.settings.showHidden"))}
          {@render switchRow("showExtensions", $t("explorer.settings.showExtensions"))}
          {@render switchRow(
            "preview",
            $t("explorer.settings.previewPane"),
            $t("explorer.settings.previewPaneHint"),
          )}
        </Section>

        <Section title={$t("explorer.settings.toolbar")}>
          {@render switchRow(
            "compactToolbar",
            $t("explorer.settings.compactToolbar"),
            $t("explorer.settings.compactToolbarHint"),
          )}
          {@render switchRow("selectionInMore", $t("explorer.settings.selectionInMore"))}
        </Section>
      {:else if page === "appearance"}
        {#if standalone}
          <StandaloneTheme {prefs} />
        {:else}
          <Section title={$t("explorer.settings.pages.appearance")}>
            <Row label={$t("explorer.settings.appearanceHosted")}>
              <span></span>
            </Row>
          </Section>
        {/if}
      {:else if page === "sidebar"}
        <SidebarSettings />
      {:else if page === "defaultApp"}
        <Section title={$t("explorer.settings.defaultApp")}>
          <DefaultAppRows />
        </Section>
      {:else if page === "terminal"}
        <TerminalSettings />
      {:else if page === "transcribe"}
        <TranscribeSettings />
      {:else if page === "devices"}
        <DeviceSettings />
      {:else if page === "account"}
        <Section title={$t("explorer.settings.account")}>
          <div class="px-4 py-4">
            <DesktopAccount lang={$locale} />
          </div>
        </Section>
      {:else}
        <Section title="Eris Files">
          <Row label={$t("explorer.settings.version")} value={version}>
            <span></span>
          </Row>

          {#if standalone}
            <Row
              label={$t("explorer.settings.rerunSetup")}
              hint={$t("explorer.settings.rerunSetupHint")}
            >
              <button type="button" class="btn btn-soft btn-sm" onclick={rerunSetup}>
                {$t("explorer.settings.run")}
              </button>
            </Row>
          {/if}

          <Row
            label={$t("explorer.settings.reset")}
            hint={$t("explorer.settings.resetHint")}
          >
            <button
              type="button"
              class="btn btn-soft btn-error btn-sm"
              onclick={() => (resetting = true)}
            >
              {$t("explorer.settings.resetAction")}
            </button>
          </Row>
        </Section>
      {/if}
    </PrefsWindow>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{$t("common.close")}</button>
  </form>
</dialog>

<Confirm
  bind:open={resetting}
  title={$t("explorer.settings.resetTitle")}
  body={$t("explorer.settings.resetBody")}
  action={$t("explorer.settings.resetAction")}
  onconfirm={resetPrefs}
/>
