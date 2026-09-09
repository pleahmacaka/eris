<script module lang="ts">
  import { relaunch } from "@tauri-apps/plugin-process"
  import { check, type Update } from "@tauri-apps/plugin-updater"

  type UpdateState = "idle" | "checking" | "none" | "available" | "downloading" | "installing" | "failed"

  let update = $state<Update | null>(null)
  let updateState = $state<UpdateState>("idle")
  let updateError = $state("")
  let downloaded = $state(0)
  let downloadTotal = $state(0)

  const downloadPercent = $derived(
    downloadTotal > 0 ? Math.min(100, Math.round((downloaded / downloadTotal) * 100)) : 0,
  )

  const checkUpdates = async () => {
    updateState = "checking"
    updateError = ""

    try {
      update = await check()
      updateState = update ? "available" : "none"
    } catch (e) {
      updateError = String(e)
      updateState = "failed"
    }
  }

  const installUpdate = async () => {
    if (!update) {
      return
    }

    updateState = "downloading"
    downloaded = 0
    downloadTotal = 0

    try {
      await update.downloadAndInstall(event => {
        if (event.event === "Started") {
          downloadTotal = event.data.contentLength ?? 0
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength
        } else {
          updateState = "installing"
        }
      })

      await relaunch()
    } catch (e) {
      updateError = String(e)
      updateState = "failed"
    }
  }
</script>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Row } from "@eris/ui"
  import { t } from "svelte-i18n"
</script>

<Row label={$t("settings.rows.updates")} hint={$t("settings.hints.updates")} stacked>
  <div class="flex flex-wrap items-center gap-2">
    {#if updateState === "available" && update}
      <span class="text-sm">
        {$t("settings.about.available", { values: { version: update.version } })}
      </span>

      <button type="button" class="btn btn-primary btn-sm" onclick={installUpdate}>
        <Icon icon="lucide:download" class="size-4" />
        {$t("settings.about.installRestart")}
      </button>
    {:else if updateState === "downloading" || updateState === "installing"}
      <progress class="progress progress-primary w-40" value={downloadPercent} max="100"
      ></progress>

      <span class="text-sm text-base-content/70">
        {updateState === "installing"
          ? $t("settings.about.installing")
          : $t("settings.about.downloading", { values: { percent: downloadPercent } })}
      </span>
    {:else}
      <button
        type="button"
        class="btn btn-sm"
        disabled={updateState === "checking"}
        onclick={checkUpdates}
      >
        <Icon icon="lucide:refresh-cw" class={["size-4", updateState === "checking" && "animate-spin"]} />
        {updateState === "checking"
          ? $t("settings.about.checking")
          : $t("settings.about.checkUpdates")}
      </button>

      {#if updateState === "none"}
        <span class="text-sm text-success">{$t("settings.about.upToDate")}</span>
      {:else if updateState === "failed"}
        <span class="text-sm text-error">
          {$t("settings.about.failed", { values: { error: updateError } })}
        </span>
      {/if}
    {/if}
  </div>
</Row>
