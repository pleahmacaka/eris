<script lang="ts">
  import { DesktopAccount } from "@eris/auth/tauri"
  import { Row, Section } from "@eris/ui"
  import { getVersion } from "@tauri-apps/api/app"
  import type { Snippet } from "svelte"
  import { locale, t } from "svelte-i18n"
  import { prefs } from "./prefs.svelte"
  import { session } from "./tabs.svelte"

  let { fallback, theme }: { fallback: string; theme?: Snippet } = $props()

  let dialog = $state<HTMLDialogElement>()
  let version = $state("")

  $effect(() => {
    if (!dialog) {
      return
    }

    if (session.settingsOpen && !dialog.open) {
      dialog.showModal()
      getVersion().then(value => (version = value))
    } else if (!session.settingsOpen && dialog.open) {
      dialog.close()
    }
  })
</script>

<dialog
  bind:this={dialog}
  class="modal"
  onclose={() => (session.settingsOpen = false)}
>
  <div
    class={[
      "modal-box flex max-w-lg flex-col gap-4 border border-base-content/10",
      "bg-base-100",
    ]}
  >
    <h3 class="text-base font-semibold">{$t("terminal.settings.title")}</h3>

    <Section title={$t("terminal.settings.general")}>
      <Row label={$t("terminal.settings.shell")}>
        <select
          class="select select-sm w-48"
          aria-label={$t("terminal.settings.shell")}
          value={prefs.shell ?? fallback}
          onchange={e => (prefs.shell = e.currentTarget.value)}
        >
          {#each session.shells as shell (shell.id)}
            <option value={shell.id}>{shell.name}</option>
          {/each}
        </select>
      </Row>

      <Row
        label={$t("terminal.settings.font")}
        hint={$t("terminal.settings.fontHint")}
      >
        <input
          class="input input-sm w-48"
          aria-label={$t("terminal.settings.font")}
          spellcheck="false"
          bind:value={prefs.fontFamily}
        />
      </Row>

      <Row label={$t("terminal.settings.fontSize")} value={`${prefs.fontSize}`}>
        <input
          type="range"
          class="range range-primary range-xs w-48"
          aria-label={$t("terminal.settings.fontSize")}
          min="10"
          max="24"
          step="1"
          bind:value={prefs.fontSize}
        />
      </Row>
    </Section>

    <Section title={$t("terminal.settings.account")}>
      <div class="px-4 py-4">
        <DesktopAccount lang={$locale} />
      </div>
    </Section>

    <Section title={$t("terminal.settings.theme")}>
      {@render theme?.()}

      <Row label={$t("terminal.settings.version")} value={version}>
        <span></span>
      </Row>
    </Section>

    <div class="modal-action mt-0">
      <button
        type="button"
        class="btn btn-sm"
        onclick={() => (session.settingsOpen = false)}
      >
        {$t("common.close")}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{$t("common.close")}</button>
  </form>
</dialog>
