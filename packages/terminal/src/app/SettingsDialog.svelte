<script lang="ts">
  import {
    Confirm,
    type PrefsPage,
    PrefsWindow,
    Row,
    Section,
    StandaloneTheme,
  } from "@eris/ui"
  import { getVersion } from "@tauri-apps/api/app"
  import { locale, t } from "svelte-i18n"
  import { prefs, resetPrefs } from "./prefs.svelte"
  import { defaultShell, session } from "./tabs.svelte"

  let { standalone = false }: { standalone?: boolean } = $props()

  const PAGES: [string, string][] = [
    ["general", "lucide:square-terminal"],
    ["appearance", "lucide:palette"],
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
      label: $t(`terminal.settings.${id}`),
    })),
  )

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
    class="modal-box h-[min(38rem,90vh)] w-[min(56rem,94vw)] max-w-none overflow-hidden border border-base-content/10 bg-base-100 p-0"
  >
    <PrefsWindow
      title={$t("terminal.settings.title")}
      {pages}
      bind:page
      onclose={() => (session.settingsOpen = false)}
    >
      {#if page === "general"}
        <Section title={$t("terminal.settings.general")}>
          <Row label={$t("terminal.settings.shell")}>
            <select
              class="select select-sm w-48"
              aria-label={$t("terminal.settings.shell")}
              value={defaultShell(prefs.shell)}
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
      {:else if page === "appearance"}
        {#if standalone}
          <StandaloneTheme {prefs} />
        {:else}
          <Section title={$t("terminal.settings.appearance")}>
            <Row label={$t("terminal.settings.appearanceHosted")}>
              <span></span>
            </Row>
          </Section>
        {/if}
      {:else if page === "account"}
        <Section title={$t("terminal.settings.account")}>
          <div class="px-4 py-4">
            {#await import("@eris/auth/tauri") then { DesktopAccount }}
              <DesktopAccount lang={$locale} />
            {/await}
          </div>
        </Section>
      {:else}
        <Section title="Eris Terminal">
          <Row label={$t("terminal.settings.version")} value={version}>
            <span></span>
          </Row>

          <Row
            label={$t("terminal.settings.reset")}
            hint={$t("terminal.settings.resetHint")}
          >
            <button
              type="button"
              class="btn btn-soft btn-error btn-sm"
              onclick={() => (resetting = true)}
            >
              {$t("terminal.settings.resetAction")}
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
  title={$t("terminal.settings.resetTitle")}
  body={$t("terminal.settings.resetBody")}
  action={$t("terminal.settings.resetAction")}
  onconfirm={resetPrefs}
/>
