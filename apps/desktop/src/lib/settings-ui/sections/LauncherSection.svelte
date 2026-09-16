<script lang="ts">
  import {
    type DeviceSettings,
    type Profile,
    defaultDevice,
    defaultProfile,
  } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import FeatureGate from "../FeatureGate.svelte"
  import HotkeyPicker from "../HotkeyPicker.svelte"
  import { reset } from "../reset"
  import { shortcuts } from "../shortcuts"

  let {
    profile = $bindable(),
    device = $bindable(),
  }: { profile: Profile; device: DeviceSettings } = $props()

  const resetDevice = reset(() => device, defaultDevice)
  const resetLauncher = reset(() => profile.launcher, defaultProfile.launcher)

  const groups = $derived(shortcuts($t, device, device.features.chat))
</script>

<FeatureGate bind:device feature="launcher" />

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.launcher && "opacity-40",
  ]}
  disabled={!device.features.launcher}
>
<Section
  title={$t("settings.groups.hotkey.title")}
  description={$t("settings.groups.hotkey.description")}
>
  <Row
    label={$t("settings.rows.openWith")}
    hint={$t("settings.hints.openWith")}
    onreset={resetDevice("launcherTrigger")}
  >
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
    <Row
      label={$t("settings.rows.shortcut")}
      hint={$t("settings.hints.shortcut")}
      onreset={resetDevice("launcherShortcut")}
    >
      <HotkeyPicker bind:value={device.launcherShortcut} />
    </Row>
  {/if}
</Section>

<Section title={$t("settings.groups.results")}>
  <Row
    label={$t("settings.rows.resultsPerGroup")}
    value={String(profile.launcher.maxResults)}
    stacked
    onreset={resetLauncher("maxResults")}
  >
    <input
      type="range"
      class="range range-primary range-xs w-full"
      min="3"
      max="15"
      step="1"
      aria-label={$t("settings.rows.resultsPerGroup")}
      bind:value={profile.launcher.maxResults}
    />
  </Row>

  <Row
    label={$t("settings.rows.openWindows")}
    hint={$t("settings.hints.openWindows")}
    onreset={resetLauncher("showWindows")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.openWindows")}
      bind:checked={profile.launcher.showWindows}
    />
  </Row>

  <Row
    label={$t("settings.rows.commands")}
    hint={$t("settings.hints.commands")}
    onreset={resetLauncher("showCommands")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.commands")}
      bind:checked={profile.launcher.showCommands}
    />
  </Row>

  <Row
    label={$t("settings.rows.todos")}
    hint={$t("settings.hints.todos")}
    onreset={resetLauncher("showTodos")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.todos")}
      bind:checked={profile.launcher.showTodos}
    />
  </Row>

  <Row
    label={$t("settings.rows.calculator")}
    hint={$t("settings.hints.calculator")}
    onreset={resetLauncher("calculator")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.calculator")}
      bind:checked={profile.launcher.calculator}
    />
  </Row>

  <Row
    label={$t("settings.rows.webSearch")}
    hint={$t("settings.hints.webSearch")}
    onreset={resetLauncher("webSearch")}
  >
    <select
      class="select select-sm w-40"
      aria-label={$t("settings.rows.webSearch")}
      bind:value={profile.launcher.webSearch}
    >
      <option value="google">Google</option>
      <option value="duckduckgo">DuckDuckGo</option>
      <option value="bing">Bing</option>
      <option value="naver">Naver</option>
    </select>
  </Row>
</Section>

<div data-row={$t("settings.rows.keyboardShortcuts")}>
  <Section
    title={$t("settings.groups.shortcuts.title")}
    description={$t("settings.groups.shortcuts.description")}
  >
    {#each groups as group (group.title)}
      <div class="py-1">
        <span
          class="block px-4 pt-2 pb-1 text-xs font-semibold text-base-content/60"
        >
          {group.title}
        </span>

        {#each group.items as s, at (at)}
          <div
            class="flex items-center justify-between gap-4 px-4 py-1.5"
          >
            <span class="text-sm">{s.action}</span>

            <div class="flex items-center gap-1">
              {#each s.keys as key, i (i)}
                <kbd class="kbd kbd-sm">{key}</kbd>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </Section>
</div>
</fieldset>
