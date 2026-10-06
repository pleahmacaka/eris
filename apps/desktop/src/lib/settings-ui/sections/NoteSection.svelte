<script lang="ts">
  import Icon from "@iconify/svelte"
  import { type DeviceSettings, defaultDevice, type NoteLink } from "@eris/settings"
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { type NoteStatus, noteStatus, openUrl } from "$lib/native"
  import { reset } from "../reset"

  type Feature = Exclude<keyof NoteLink, "enabled">

  let { device = $bindable() }: { device: DeviceSettings } = $props()

  const FEATURES: Feature[] = ["calendar", "style", "references", "preview"]

  const resetNote = reset(() => device.note, defaultDevice.note)

  let status = $state<NoteStatus | null>(null)

  const refresh = () =>
    noteStatus()
      .then(next => (status = next))
      .catch(() => (status = { installed: false, vault: null, linked: false }))

  $effect(() => {
    refresh()
  })

  const link = $derived(
    !status ? null : !status.installed ? "missing" : status.linked ? "linked" : "waiting",
  )

  const usable = $derived(status?.installed === true && device.note.enabled)
</script>

<svelte:window onfocus={refresh} />

<Section
  title={$t("settings.groups.note.title")}
  description={$t("settings.groups.note.description")}
>
  <Row label={$t("settings.rows.noteStatus")} hint={status?.vault ?? $t("settings.hints.noteStatus")}>
    <div class="flex items-center gap-2">
      {#if link}
        <span
          class={[
            "badge badge-sm badge-soft",
            link === "linked" ? "badge-success" : link === "waiting" ? "badge-warning" : "badge-neutral",
          ]}
        >
          {$t(`settings.note.states.${link}`)}
        </span>
      {/if}

      {#if status?.installed}
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          onclick={() => openUrl("arixlab-note://open").catch(() => undefined)}
        >
          <Icon icon="lucide:external-link" class="size-3.5" />
          {$t("settings.note.open")}
        </button>
      {/if}
    </div>
  </Row>

  <Row
    label={$t("settings.rows.noteLink")}
    hint={$t("settings.hints.noteLink")}
    onreset={resetNote("enabled")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.noteLink")}
      disabled={!status?.installed}
      bind:checked={device.note.enabled}
    />
  </Row>

  {#each FEATURES as feature (feature)}
    <Row
      label={$t(`settings.rows.note.${feature}`)}
      hint={$t(`settings.hints.note.${feature}`)}
      onreset={resetNote(feature)}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t(`settings.rows.note.${feature}`)}
        disabled={!usable}
        bind:checked={device.note[feature]}
      />
    </Row>
  {/each}
</Section>
