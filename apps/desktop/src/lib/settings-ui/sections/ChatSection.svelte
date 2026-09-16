<script lang="ts">
  import { emit } from "@tauri-apps/api/event"
  import { type DeviceSettings, defaultDevice } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import FeatureGate from "../FeatureGate.svelte"
  import HotkeyPicker from "../HotkeyPicker.svelte"
  import { reset } from "../reset"

  let { device = $bindable() }: { device: DeviceSettings } = $props()

  const resetRow = reset(() => device, defaultDevice)

  let snapTimer: ReturnType<typeof setTimeout> | undefined

  const previewSnap = () => {
    clearTimeout(snapTimer)
    emit("chat-snap-preview", { percent: device.chatSnap, on: true }).catch(() => undefined)
    snapTimer = setTimeout(() => {
      emit("chat-snap-preview", { percent: device.chatSnap, on: false }).catch(() => undefined)
    }, 1500)
  }
</script>

<FeatureGate bind:device feature="chat" />

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.chat && "opacity-40",
  ]}
  disabled={!device.features.chat}
>
  <Section
    title={$t("settings.groups.chatHotkey.title")}
    description={$t("settings.groups.chatHotkey.description")}
  >
    <Row
      label={$t("settings.rows.chatShortcut")}
      hint={$t("settings.hints.chatShortcut")}
      onreset={resetRow("chatShortcut")}
    >
      <HotkeyPicker bind:value={device.chatShortcut} fallback="Ctrl+Space" />
    </Row>
  </Section>

  <Section
    title={$t("settings.groups.chat.title")}
    description={$t("settings.groups.chat.description")}
  >
    <Row
      label={$t("settings.rows.snapDistance")}
      value="{device.chatSnap}%"
      stacked
      onreset={resetRow("chatSnap")}
    >
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

    <Row
      label={$t("settings.rows.chatModel")}
      hint={$t("settings.hints.chatModel")}
      onreset={resetRow("chatModel")}
    >
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

    <Row
      label={$t("settings.rows.chatEffort")}
      hint={$t("settings.hints.chatEffort")}
      tag="partial"
      onreset={resetRow("chatEffort")}
    >
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

    <Row
      label={$t("settings.rows.chatPermission")}
      hint={$t("settings.hints.chatPermission")}
      onreset={resetRow("chatPermission")}
    >
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

    <Row
      label={$t("settings.rows.chatThinking")}
      hint={$t("settings.hints.chatThinking")}
      tag="partial"
      onreset={resetRow("chatThinking")}
    >
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

    <Row
      label={$t("settings.rows.chatAutoCompact")}
      hint={$t("settings.hints.chatAutoCompact")}
      tag="partial"
      onreset={resetRow("chatAutoCompact")}
    >
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

    <Row
      label={$t("settings.rows.chatLanguage")}
      hint={$t("settings.hints.chatLanguage")}
      tag="partial"
      onreset={resetRow("chatLanguage")}
    >
      <input
        class="input input-sm w-40"
        placeholder={$t("chat.config.languageDefault")}
        aria-label={$t("settings.rows.chatLanguage")}
        bind:value={device.chatLanguage}
      />
    </Row>

    <Row
      label={$t("settings.rows.chatBudget")}
      hint={$t("settings.hints.chatBudget")}
      tag="partial"
      onreset={resetRow("chatBudget")}
    >
      <input
        type="number"
        min="0"
        step="0.5"
        class="input input-sm w-40"
        aria-label={$t("settings.rows.chatBudget")}
        bind:value={device.chatBudget}
      />
    </Row>

    <Row
      label={$t("settings.rows.chatSystemPrompt")}
      hint={$t("settings.hints.chatSystemPrompt")}
      tag="partial"
      stacked
      onreset={resetRow("chatSystemPrompt")}
    >
      <textarea
        class="textarea textarea-sm w-full"
        rows="3"
        aria-label={$t("settings.rows.chatSystemPrompt")}
        bind:value={device.chatSystemPrompt}
      ></textarea>
    </Row>

    <Row
      label={$t("settings.rows.chatHover")}
      hint={$t("settings.hints.chatHover")}
      onreset={resetRow("chatHover")}
    >
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

    <Row
      label={$t("settings.rows.chatMultiBubble")}
      hint={$t("settings.hints.chatMultiBubble")}
      tag="partial"
      onreset={resetRow("chatMultiBubble")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.chatMultiBubble")}
        bind:checked={device.chatMultiBubble}
      />
    </Row>

    <Row
      label={$t("settings.rows.chatBubbleColors")}
      hint={$t("settings.hints.chatBubbleColors")}
      onreset={resetRow("chatBubbleColors")}
    >
      <input
        type="checkbox"
        class="toggle toggle-primary"
        aria-label={$t("settings.rows.chatBubbleColors")}
        bind:checked={device.chatBubbleColors}
      />
    </Row>

    <Row
      label={$t("settings.rows.chatQueueMode")}
      hint={$t("settings.hints.chatQueueMode")}
      onreset={resetRow("chatQueueMode")}
    >
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
</fieldset>
