<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Logo } from "@eris/ui"
  import { t } from "svelte-i18n"
  import TabStrip from "./TabStrip.svelte"
  import { session } from "./tabs.svelte"
  import WindowControls from "./WindowControls.svelte"
</script>

<header
  data-tauri-drag-region
  class="flex h-10 shrink-0 items-stretch bg-base-300/60 select-none"
>
  <div data-tauri-drag-region class="flex items-center pr-1 pl-3">
    <Logo class="pointer-events-none size-4" />
  </div>

  <TabStrip />

  <div data-tauri-drag-region class="grow"></div>

  <button
    type="button"
    class="btn btn-ghost h-full rounded-none border-0 px-3"
    aria-label={$t("terminal.settings.title")}
    title={$t("terminal.settings.title")}
    onclick={() => (session.settingsOpen = true)}
  >
    <Icon icon="lucide:settings" class="size-4" />
  </button>

  <WindowControls />
</header>
