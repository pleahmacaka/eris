<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window"
  import { stopEdit } from "$lib/edit/edit.svelte"
  import * as native from "$lib/native"

  document.documentElement.dataset.surface = "edit"

  let home = $state({ left: 0, width: 0 })

  const locate = async () => {
    const [monitor, origin] = await Promise.all([
      primaryMonitor(),
      getCurrentWindow().outerPosition(),
    ])

    if (!monitor) {
      return
    }

    home = {
      left: (monitor.position.x - origin.x) / monitor.scaleFactor,
      width: monitor.size.width / monitor.scaleFactor,
    }
  }

  $effect(() => {
    native.editRaise().catch(() => undefined)
    locate().catch(() => undefined)
  })
</script>

<svelte:window onkeydown={e => e.key === "Escape" && stopEdit()} />

<div
  role="presentation"
  class="relative h-full w-full bg-black/55"
  onclick={stopEdit}
>
  <div
    role="presentation"
    class="absolute top-20 flex w-max max-w-full items-center gap-4 rounded-box border border-base-content/10 bg-base-100/95 px-5 py-3 shadow-2xl backdrop-blur-xl"
    style:left="{home.left + home.width / 2}px"
    style:translate="-50% 0"
    onclick={e => e.stopPropagation()}
  >
    <Icon icon="lucide:pencil-ruler" class="size-6 text-primary" />

    <div class="flex flex-col">
      <span class="text-base font-semibold">{$t("edit.title")}</span>

      <span class="text-sm text-base-content/60">{$t("edit.hint")}</span>
    </div>

    <button type="button" class="btn btn-primary btn-sm" onclick={stopEdit}>
      {$t("edit.done")}
    </button>
  </div>
</div>
