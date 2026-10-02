<script lang="ts">
  import Icon from "@iconify/svelte"
  import { open } from "@tauri-apps/plugin-dialog"
  import { t } from "svelte-i18n"
  import { type Safety, syncCheck } from "./share"

  let {
    folder = $bindable(""),
    ready = $bindable(false),
  }: { folder?: string; ready?: boolean } = $props()

  let safety = $state<Safety | null>(null)
  let accepted = $state(false)

  $effect(() => {
    const path = folder

    accepted = false
    safety = null

    if (!path) {
      return
    }

    syncCheck(path)
      .then(level => {
        if (folder === path) {
          safety = level
        }
      })
      .catch(() => undefined)
  })

  $effect(() => {
    ready =
      !!folder &&
      safety !== null &&
      safety !== "blocked" &&
      (safety === "ok" || accepted)
  })

  const pick = async () => {
    const chosen = await open({
      directory: true,
      defaultPath: folder || undefined,
    })

    if (typeof chosen === "string") {
      folder = chosen
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-center gap-2">
    <span
      class={["min-w-0 flex-1 truncate text-sm", !folder && "text-base-content/60"]}
      title={folder}
    >
      {folder || $t("share.sync.noFolder")}
    </span>

    <button type="button" class="btn btn-xs btn-soft shrink-0" onclick={pick}>
      <Icon icon="lucide:folder-open" class="size-3.5" />
      {$t("share.sync.pick")}
    </button>
  </div>

  <div class="flex flex-col gap-1 rounded-field bg-warning/10 px-3 py-2 text-xs">
    <span class="flex items-start gap-2 text-warning">
      <Icon icon="lucide:triangle-alert" class="mt-0.5 size-3.5 shrink-0" />
      {$t("share.sync.warning")}
    </span>

    {#if safety === "warn"}
      <span class="text-base-content/80">{$t("share.sync.warnAppData")}</span>

      <label class="mt-1 flex cursor-pointer items-center gap-2">
        <input type="checkbox" class="checkbox checkbox-xs" bind:checked={accepted} />
        {$t("share.sync.confirm")}
      </label>
    {:else if safety === "blocked"}
      <span class="text-error">{$t("share.sync.blocked")}</span>
    {/if}
  </div>
</div>
