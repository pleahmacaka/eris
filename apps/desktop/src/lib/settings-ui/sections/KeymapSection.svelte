<script lang="ts">
  import type { DeviceSettings } from "@eris/settings"
  import { Row, Section, Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import HotkeyPicker from "../HotkeyPicker.svelte"
  import { shortcuts } from "../shortcuts"

  let { device = $bindable() }: { device: DeviceSettings } = $props()

  const groups = $derived(shortcuts($t, device))
</script>

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
  title={$t("settings.groups.chatHotkey.title")}
  description={$t("settings.groups.chatHotkey.description")}
>
  <Row label={$t("settings.rows.chatShortcut")} hint={$t("settings.hints.chatShortcut")}>
    <HotkeyPicker bind:value={device.chatShortcut} fallback="Ctrl+Space" />
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
