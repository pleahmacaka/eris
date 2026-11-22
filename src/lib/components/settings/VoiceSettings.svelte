<script lang="ts">
import { untrack } from "svelte"
import LevelMeter from "#lib/components/settings/LevelMeter.svelte"
import SettingsCard from "#lib/components/settings/SettingsCard.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { AudioProcessing } from "#lib/media/devices.js"
import { audioStore } from "#lib/store/audio.svelte.js"

const PROCESSING: { key: AudioProcessing; label: MessageKey }[] = [
  { key: "echoCancellation", label: "settings.voice.echoCancellation" },
  { key: "noiseSuppression", label: "settings.voice.noiseSuppression" },
  { key: "autoGainControl", label: "settings.voice.autoGainControl" },
]

const toggleTest = () =>
  audioStore.testing ? audioStore.stopTest() : audioStore.startTest()

$effect(() => {
  const stopWatching = untrack(() => audioStore.watchDevices())

  return () => {
    stopWatching()
    audioStore.stopTest()
  }
})
</script>

<SettingsCard title={i18n.t("keymap.group.voice")}>
  {#if audioStore.needsAccess}
    <div
      class="flex flex-wrap items-center justify-between gap-3 rounded-field bg-base-content/5 px-3 py-2"
    >
      <p class="text-sm">{i18n.t("settings.voice.permissionHint")}</p>
      <button type="button" class="btn btn-sm" onclick={() => audioStore.requestAccess()}>
        {i18n.t("settings.voice.loadDevices")}
      </button>
    </div>
  {/if}

  <label class="flex flex-col gap-1.5">
    <span class="font-semibold text-sm">{i18n.t("settings.voice.input")}</span>
    <select
      id="audio-input"
      class="select w-full"
      onchange={event => audioStore.selectInput(event.currentTarget.value || null)}
    >
      <option value="" selected={audioStore.inputId === null}>{i18n.t("settings.voice.systemDefault")}</option>
      {#each audioStore.inputs as option (option.id)}
        <option value={option.id} selected={option.id === audioStore.inputId}>
          {i18n.text(option.label)}
        </option>
      {/each}
    </select>
  </label>

  {#if audioStore.outputSelectable}
    <label class="flex flex-col gap-1.5">
      <span class="font-semibold text-sm">{i18n.t("settings.voice.output")}</span>
      <select
        id="audio-output"
        class="select w-full"
        onchange={event => audioStore.selectOutput(event.currentTarget.value || null)}
      >
        <option value="" selected={audioStore.outputId === null}>{i18n.t("settings.voice.systemDefault")}</option>
        {#each audioStore.outputs as option (option.id)}
          <option value={option.id} selected={option.id === audioStore.outputId}>
            {i18n.text(option.label)}
          </option>
        {/each}
      </select>
    </label>
  {:else}
    <div class="flex flex-col gap-1.5">
      <p class="font-semibold text-sm">{i18n.t("settings.voice.output")}</p>
      <p class="text-muted text-sm">
        {i18n.t("settings.voice.outputUnsupported")}
      </p>
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <p class="font-semibold text-sm">{i18n.t("settings.voice.micTest")}</p>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn btn-sm w-28 shrink-0"
        aria-pressed={audioStore.testing}
        onclick={toggleTest}
      >
        {i18n.t(audioStore.testing ? "settings.voice.testStop" : "settings.voice.testStart")}
      </button>
      <LevelMeter level={audioStore.level} />
    </div>
    <p class="text-muted text-xs">{i18n.t("settings.voice.testHint")}</p>
  </div>

  <div class="flex flex-col gap-3 border-base-content/10 border-t pt-4">
    <p class="font-semibold text-sm">{i18n.t("settings.voice.processing")}</p>
    {#each PROCESSING as item (item.key)}
      <label class="flex cursor-pointer items-center justify-between gap-4">
        <span class="min-w-0 text-sm">{i18n.t(item.label)}</span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={audioStore.prefs[item.key]}
          onchange={event => audioStore.setProcessing(item.key, event.currentTarget.checked)}
        />
      </label>
    {/each}
  </div>

  {#if audioStore.error}
    <p class="text-error text-sm" role="alert">{i18n.text(audioStore.error)}</p>
  {/if}
</SettingsCard>
