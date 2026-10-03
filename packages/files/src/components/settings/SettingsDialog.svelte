<script lang="ts">
  import { DesktopAccount } from "@eris/auth/tauri"
  import { getVersion } from "@tauri-apps/api/app"
  import { Row, Section, toast } from "@eris/ui"
  import type { Snippet } from "svelte"
  import { locale, t } from "svelte-i18n"
  import TranscribeSettings from "../audio/TranscribeSettings.svelte"
  import DeviceSettings from "../share/DeviceSettings.svelte"
  import TerminalSettings from "../terminal/TerminalSettings.svelte"
  import SidebarSettings from "./SidebarSettings.svelte"
  import {
    type DefaultApp,
    defaultAppStatus,
    openDefaultApps,
    setDefaultApp,
  } from "../../native"
  import { prefs } from "../../store/prefs.svelte"

  let { open = $bindable(false), theme }: { open?: boolean; theme?: Snippet } =
    $props()

  let dialog = $state<HTMLDialogElement>()
  let handler = $state<DefaultApp>({ supported: false, enabled: false })
  let version = $state("")

  $effect(() => {
    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
      defaultAppStatus().then(status => (handler = status))
      getVersion().then(value => (version = value))
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })

  const toggleDefault = async (toggle: HTMLInputElement) => {
    try {
      handler = await setDefaultApp(toggle.checked)
    } catch {
      toast($t("explorer.settings.defaultAppUnavailable"), "error")
    }

    toggle.checked = handler.enabled
  }
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
  <div
    class={[
      "modal-box flex max-h-4/5 max-w-lg flex-col gap-4 overflow-hidden border border-base-content/10",
      "bg-base-100",
    ]}
  >
    <h3 class="text-base font-semibold">{$t("explorer.settings.title")}</h3>

    <div class="-mx-6 flex min-h-0 flex-col gap-4 overflow-y-auto px-6">
      <Section title={$t("explorer.settings.general")}>
        <Row label={$t("explorer.settings.showHidden")}>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            bind:checked={prefs.showHidden}
          />
        </Row>

        <Row label={$t("explorer.settings.showExtensions")}>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            bind:checked={prefs.showExtensions}
          />
        </Row>

        <Row label={$t("explorer.settings.selectionInMore")}>
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            bind:checked={prefs.selectionInMore}
          />
        </Row>
      </Section>

      <Section title={$t("explorer.settings.defaultApp")}>
        <Row
          label={$t("explorer.settings.defaultAppLabel")}
          hint={handler.supported
            ? $t("explorer.settings.defaultAppHint")
            : $t("explorer.settings.defaultAppUnavailable")}
        >
          <input
            type="checkbox"
            class="toggle toggle-sm toggle-primary"
            checked={handler.enabled}
            onchange={e => toggleDefault(e.currentTarget)}
          />
        </Row>

        <Row
          label={$t("explorer.settings.windowsDefaults")}
          hint={$t("explorer.settings.windowsDefaultsHint")}
        >
          <button
            type="button"
            class="btn btn-soft btn-sm"
            disabled={!handler.supported}
            onclick={() =>
              openDefaultApps().catch(() =>
                toast($t("explorer.settings.defaultAppUnavailable"), "error"),
              )}
          >
            {$t("common.open")}
          </button>
        </Row>
      </Section>

      <SidebarSettings />

      <TranscribeSettings />

      <TerminalSettings />

      <DeviceSettings />

      <Section title={$t("explorer.settings.account")}>
        <div class="px-4 py-4">
          <DesktopAccount lang={$locale} />
        </div>
      </Section>

      <Section title={$t("explorer.settings.theme")}>
        {@render theme?.()}

        <Row label={$t("explorer.settings.version")} value={version}>
          <span></span>
        </Row>
      </Section>
    </div>

    <div class="modal-action mt-0">
      <button type="button" class="btn btn-sm" onclick={() => (open = false)}>
        {$t("common.close")}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{$t("common.close")}</button>
  </form>
</dialog>
