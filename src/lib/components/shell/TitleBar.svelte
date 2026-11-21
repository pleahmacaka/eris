<script lang="ts">
import Icon from "@iconify/svelte"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { onMount } from "svelte"
import Logo from "#lib/components/brand/Logo.svelte"

const appWindow = getCurrentWindow()

let maximized = $state(false)

const refresh = async () => {
  maximized = await appWindow.isMaximized()
}

onMount(() => {
  void refresh()

  const unlisten = appWindow.onResized(() => void refresh())

  return () => {
    void unlisten.then(stop => stop())
  }
})

import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<header
  class="flex h-8 shrink-0 select-none items-center bg-base-300 ps-3 text-xs"
  data-tauri-drag-region
>
  <Logo class="pointer-events-none size-4" />
  <span class="pointer-events-none ms-2 font-black tracking-tighter uppercase">Eris</span>
  <span class="flex-1" data-tauri-drag-region></span>
  <button
    type="button"
    class="flex h-8 w-11 cursor-pointer items-center justify-center hover:bg-base-content/10"
    aria-label={i18n.t("shell.window.minimize")}
    title={i18n.t("shell.window.minimize")}
    onclick={() => appWindow.minimize()}
  >
    <Icon icon="lucide:minus" class="size-4" />
  </button>
  <button
    type="button"
    class="flex h-8 w-11 cursor-pointer items-center justify-center hover:bg-base-content/10"
    aria-label={i18n.t(maximized ? "shell.window.restore" : "shell.window.maximize")}
    title={i18n.t(maximized ? "shell.window.restore" : "shell.window.maximize")}
    onclick={() => appWindow.toggleMaximize()}
  >
    <Icon icon={maximized ? "lucide:copy" : "lucide:square"} class="size-3.5" />
  </button>
  <button
    type="button"
    class="flex h-8 w-11 cursor-pointer items-center justify-center hover:bg-error hover:text-error-content"
    aria-label={i18n.t("ui.close")}
    title={i18n.t("ui.close")}
    onclick={() => appWindow.close()}
  >
    <Icon icon="lucide:x" class="size-4" />
  </button>
</header>
