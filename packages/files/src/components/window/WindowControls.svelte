<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"

  const current = getCurrentWindow()

  const BUTTON = "btn btn-ghost h-full rounded-none border-0 px-4"

  let maximized = $state(false)

  $effect(() => {
    const sync = () => {
      current.isMaximized().then(value => (maximized = value))
    }

    sync()

    const stop = current.onResized(sync)

    return () => {
      stop.then(unlisten => unlisten())
    }
  })
</script>

<div class="flex h-full shrink-0 items-stretch">
  <button
    type="button"
    class={BUTTON}
    aria-label={$t("explorer.window.minimize")}
    onclick={() => current.minimize()}
  >
    <Icon icon="lucide:minus" class="size-4" />
  </button>

  <button
    type="button"
    class={BUTTON}
    aria-label={$t(
      maximized ? "explorer.window.restore" : "explorer.window.maximize",
    )}
    onclick={() => current.toggleMaximize()}
  >
    <Icon icon={maximized ? "lucide:copy" : "lucide:square"} class="size-3.5" />
  </button>

  <button
    type="button"
    class={[BUTTON, "hover:bg-error hover:text-error-content"]}
    aria-label={$t("explorer.window.close")}
    onclick={() => current.close()}
  >
    <Icon icon="lucide:x" class="size-4" />
  </button>
</div>
