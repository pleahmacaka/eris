<script lang="ts">
  import Icon from "@iconify/svelte"
  import { ModelViewer, viewerLocale } from "@eris/model-viewer"
  import { locale, t } from "svelte-i18n"
  import WindowControls from "./components/window/WindowControls.svelte"
  import { baseName } from "./locations"
  import { assetUrl, modelFiles, takeIntent } from "./native"

  type Model = { name: string; objUrl: string; mtlUrl?: string }

  let model = $state<Model | null>(null)
  let failed = $state(false)

  takeIntent()
    .then(intent => {
      if (!intent.path) {
        throw new Error("missing")
      }

      return modelFiles(intent.path)
    })
    .then(files => {
      model = {
        name: baseName(files.obj),
        objUrl: assetUrl(files.obj),
        mtlUrl: files.mtl ? assetUrl(files.mtl) : undefined,
      }
    })
    .catch(() => (failed = true))
</script>

<div class="flex h-full min-h-0 flex-col">
  <header
    data-tauri-drag-region
    class="flex h-10 shrink-0 items-center gap-2 pl-3 select-none"
  >
    <Icon icon="lucide:box" class="size-4 text-base-content/60" />

    <span class="truncate text-sm">
      {model?.name ?? $t("explorer.viewer.title")}
    </span>

    <div data-tauri-drag-region class="h-full grow"></div>

    <WindowControls />
  </header>

  <main class="relative min-h-0 grow bg-base-100/70">
    {#if model}
      <ModelViewer
        objUrl={model.objUrl}
        mtlUrl={model.mtlUrl}
        title={model.name}
        locale={viewerLocale($locale ?? "")}
      />
    {:else}
      <div
        class={[
          "flex size-full flex-col items-center justify-center gap-2 text-sm",
          "text-base-content/50",
        ]}
      >
        {#if failed}
          <Icon icon="lucide:circle-alert" class="size-6" />
          {$t("explorer.states.missing")}
        {:else}
          <span class="loading loading-spinner loading-md text-primary"></span>
          {$t("explorer.viewer.loading")}
        {/if}
      </div>
    {/if}
  </main>
</div>
