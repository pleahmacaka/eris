<script lang="ts">
  import { emit } from "@tauri-apps/api/event"
  import { disable, enable } from "@tauri-apps/plugin-autostart"
  import type { DeviceSettings } from "@eris/settings"
  import { LANGUAGES } from "@eris/i18n"
  import { Row, Section, Segmented, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import FeatureControls from "../FeatureControls.svelte"
  import HotkeyPicker from "../HotkeyPicker.svelte"
  import ImportExport from "../ImportExport.svelte"

  let {
    device = $bindable(),
    onreset,
  }: { device: DeviceSettings; onreset: () => void } = $props()

  let snapTimer: ReturnType<typeof setTimeout> | undefined

  const previewSnap = () => {
    clearTimeout(snapTimer)
    emit("chat-snap-preview", { percent: device.chatSnap, on: true }).catch(() => undefined)
    snapTimer = setTimeout(() => {
      emit("chat-snap-preview", { percent: device.chatSnap, on: false }).catch(() => undefined)
    }, 1500)
  }

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const setAutostart = async (on: boolean) => {
    try {
      if (on) {
        await enable()
      } else {
        await disable()
      }

      device.autostart = on
    } catch (error) {
      toast(
        $t("settings.toasts.autostartFailed", { values: { error: message(error) } }),
        "error",
      )
    }
  }
</script>

<Section title={$t("settings.groups.device")}>
  <Row label={$t("settings.rows.deviceName")} hint={$t("settings.hints.deviceName")}>
    <input
      class="input input-sm w-52"
      aria-label={$t("settings.rows.deviceName")}
      autocomplete="off"
      spellcheck="false"
      bind:value={device.deviceName}
    />
  </Row>

  <Row label={$t("settings.rows.autostart")} hint={$t("settings.hints.autostart")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.autostart")}
      checked={device.autostart}
      onchange={e => setAutostart(e.currentTarget.checked)}
    />
  </Row>

  <Row label={$t("settings.rows.hideTaskbar")} hint={$t("settings.hints.hideTaskbar")}>
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.hideTaskbar")}
      bind:checked={device.hideSystemTaskbar}
    />
  </Row>

  <Row label={$t("settings.rows.language")} hint={$t("settings.hints.language")}>
    <select
      class="select select-sm w-40"
      aria-label={$t("settings.rows.language")}
      bind:value={device.language}
    >
      {#each LANGUAGES as language (language)}
        <option value={language}>{$t(`languages.${language}`)}</option>
      {/each}
    </select>
  </Row>

  <Row label={$t("settings.rows.setupWizard")} hint={$t("settings.hints.setupWizard")}>
    <button
      type="button"
      class="btn btn-soft btn-sm"
      onclick={onreset}
    >
      {$t("settings.options.runSetup")}
    </button>
  </Row>
</Section>

<Section
  title={$t("settings.groups.features.title")}
  description={$t("settings.groups.features.description")}
>
  <FeatureControls bind:device />
</Section>

{#if device.features.chat}
  <Section
    title={$t("settings.groups.chat.title")}
    description={$t("settings.groups.chat.description")}
  >
    <Row label={$t("settings.rows.snapDistance")} value="{device.chatSnap}%" stacked>
      <input
        type="range"
        class="range range-primary range-xs w-full"
        min="5"
        max="40"
        step="1"
        aria-label={$t("settings.rows.snapDistance")}
        bind:value={device.chatSnap}
        oninput={previewSnap}
      />
    </Row>

    <Row label={$t("settings.rows.chatModel")} hint={$t("settings.hints.chatModel")}>
      <input
        class="input input-sm w-40"
        list="settings-chat-models"
        placeholder={$t("chat.config.modelDefault")}
        aria-label={$t("settings.rows.chatModel")}
        bind:value={device.chatModel}
      />

      <datalist id="settings-chat-models">
        {#each ["fable", "opus", "sonnet", "haiku", "opus[1m]", "sonnet[1m]"] as model (model)}
          <option value={model}></option>
        {/each}
      </datalist>
    </Row>

    <Row label={$t("settings.rows.chatEffort")} hint={$t("settings.hints.chatEffort")} tag="partial">
      <select
        class="select select-sm w-40"
        aria-label={$t("settings.rows.chatEffort")}
        bind:value={device.chatEffort}
      >
        {#each ["", "low", "medium", "high", "xhigh", "max"] as effort (effort)}
          <option value={effort}>{$t(`chat.effort.${effort || "default"}`)}</option>
        {/each}
      </select>
    </Row>

    <Row label={$t("settings.rows.chatPermission")} hint={$t("settings.hints.chatPermission")}>
      <select
        class="select select-sm w-40"
        aria-label={$t("settings.rows.chatPermission")}
        bind:value={device.chatPermission}
      >
        {#each ["default", "acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"] as mode (mode)}
          <option value={mode}>{$t(`chat.permission.${mode}`)}</option>
        {/each}
      </select>
    </Row>

    <Row label={$t("settings.rows.chatThinking")} hint={$t("settings.hints.chatThinking")} tag="partial">
      <select
        class="select select-sm w-40"
        aria-label={$t("settings.rows.chatThinking")}
        bind:value={device.chatThinking}
      >
        {#each ["default", "on", "off"] as tri (tri)}
          <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
        {/each}
      </select>
    </Row>

    <Row label={$t("settings.rows.chatAutoCompact")} hint={$t("settings.hints.chatAutoCompact")} tag="partial">
      <select
        class="select select-sm w-40"
        aria-label={$t("settings.rows.chatAutoCompact")}
        bind:value={device.chatAutoCompact}
      >
        {#each ["default", "on", "off"] as tri (tri)}
          <option value={tri}>{$t(`chat.tri.${tri}`)}</option>
        {/each}
      </select>
    </Row>

    <Row label={$t("settings.rows.chatLanguage")} hint={$t("settings.hints.chatLanguage")} tag="partial">
      <input
        class="input input-sm w-40"
        placeholder={$t("chat.config.languageDefault")}
        aria-label={$t("settings.rows.chatLanguage")}
        bind:value={device.chatLanguage}
      />
    </Row>

    <Row label={$t("settings.rows.chatBudget")} hint={$t("settings.hints.chatBudget")} tag="partial">
      <input
        type="number"
        min="0"
        step="0.5"
        class="input input-sm w-40"
        aria-label={$t("settings.rows.chatBudget")}
        bind:value={device.chatBudget}
      />
    </Row>

    <Row label={$t("settings.rows.chatSystemPrompt")} hint={$t("settings.hints.chatSystemPrompt")} tag="partial" stacked>
      <textarea
        class="textarea textarea-sm w-full"
        rows="3"
        aria-label={$t("settings.rows.chatSystemPrompt")}
        bind:value={device.chatSystemPrompt}
      ></textarea>
    </Row>

    <Row label={$t("settings.rows.chatHover")} hint={$t("settings.hints.chatHover")}>
      <Segmented
        label={$t("settings.rows.chatHover")}
        bind:value={device.chatHover}
        options={[
          { value: "none", label: $t("chat.hover.none") },
          { value: "title", label: $t("chat.hover.title") },
          { value: "preview", label: $t("chat.hover.preview") },
        ]}
      />
    </Row>

    <Row label={$t("settings.rows.chatMultiBubble")} hint={$t("settings.hints.chatMultiBubble")} tag="partial">
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.chatMultiBubble")}
        bind:checked={device.chatMultiBubble}
      />
    </Row>

    <Row label={$t("settings.rows.chatBubbleColors")} hint={$t("settings.hints.chatBubbleColors")}>
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.chatBubbleColors")}
        bind:checked={device.chatBubbleColors}
      />
    </Row>

    <Row label={$t("settings.rows.chatQueueMode")} hint={$t("settings.hints.chatQueueMode")}>
      <Segmented
        label={$t("settings.rows.chatQueueMode")}
        bind:value={device.chatQueueMode}
        options={[
          { value: "afterTool", label: $t("chat.queue.afterTool") },
          { value: "afterReply", label: $t("chat.queue.afterReply") },
        ]}
      />
    </Row>
  </Section>
{/if}

<Section
  title={$t("settings.groups.hotkey.title")}
  description={$t("settings.groups.hotkey.description")}
>
  <Row label={$t("settings.rows.openWith")} hint={$t("settings.hints.openWith")}>
    <Segmented
      label={$t("settings.rows.openWith")}
      bind:value={device.launcherTrigger}
      options={[
        { value: "win", label: $t("settings.options.win") },
        { value: "shortcut", label: $t("settings.options.shortcut") },
        { value: "both", label: $t("settings.options.both") },
      ]}
    />
  </Row>

  {#if device.launcherTrigger !== "win"}
    <Row label={$t("settings.rows.shortcut")} hint={$t("settings.hints.shortcut")}>
      <HotkeyPicker bind:value={device.launcherShortcut} />
    </Row>
  {/if}
</Section>

<Section
  title={$t("settings.groups.backup.title")}
  description={$t("settings.groups.backup.description")}
>
  <ImportExport />
</Section>
