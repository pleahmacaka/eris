<script lang="ts">
  import { Logo, toast } from "@eris/ui"
  import Icon from "@iconify/svelte"
  import { invoke } from "@tauri-apps/api/core"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"

  type Component = {
    id: string
    name: string
    installed: string | null
    available: boolean
  }

  type Progress = { id: string; state: "running" | "done" | "failed"; error: string | null }

  type Overview = {
    version: string
    update: boolean
    preset: string[]
    components: Component[]
    progress: Progress[]
    finished: boolean
  }

  const ICONS: Record<string, string> = {
    files: "lucide:folder-open",
    terminal: "lucide:square-terminal",
  }

  let overview = $state<Overview>({
    version: "",
    update: false,
    preset: [],
    components: [],
    progress: [],
    finished: false,
  })
  let selected = $state(new Set<string>())
  let progress = $state<Record<string, Progress>>({})
  let phase = $state<"choose" | "running" | "done">("choose")
  let release = $state<string | null>(null)
  let updating = $state(false)

  const chosen = $derived(overview.components.filter(c => selected.has(c.id)))
  const updatesOnly = $derived(chosen.length > 0 && chosen.every(c => c.installed))
  const failed = $derived(Object.values(progress).some(p => p.state === "failed"))

  const statusOf = (c: Component) => {
    if (!c.available) {
      return $t("installer.unavailable")
    }

    if (!c.installed) {
      return ""
    }

    return c.installed === overview.version
      ? $t("installer.installed")
      : $t("installer.installedVersion", { values: { version: c.installed } })
  }

  const toggle = (id: string) => {
    const next = new Set(selected)

    if (!next.delete(id)) {
      next.add(id)
    }

    selected = next
  }

  const record = (step: Progress) => {
    progress = { ...progress, [step.id]: step }
  }

  const install = () => {
    phase = "running"
    progress = {}

    invoke("install", { ids: [...selected] }).catch(reason => toast(String(reason), "error"))
  }

  const updateInstaller = async () => {
    updating = true

    await invoke("self_update").catch(reason => {
      toast($t("installer.updateFailed", { values: { reason: String(reason) } }), "error")
    })

    updating = false
  }

  $effect(() => {
    const stops = [
      listen<Progress>("install-progress", e => record(e.payload)),
      listen("install-finished", async () => {
        phase = "done"
        overview = await invoke<Overview>("overview")
      }),
    ]

    Promise.all(stops).then(async () => {
      overview = await invoke<Overview>("overview")
      selected = new Set(overview.preset)
      overview.progress.forEach(record)

      if (overview.finished) {
        phase = "done"
      } else if (overview.update) {
        phase = "running"
      } else {
        release = await invoke<string | null>("check_update").catch(() => null)
      }
    })

    return () => {
      for (const stop of stops) {
        stop.then(fn => fn())
      }
    }
  })
</script>

<main class="relative flex h-dvh flex-col gap-5 p-6">
  <header class="flex items-center gap-3">
    <Logo class="size-10" />

    <div class="flex flex-col">
      <h1 class="text-xl font-semibold tracking-tight">{$t("installer.title")}</h1>

      {#if overview.version}
        <span class="text-xs text-base-content/60 tabular-nums">
          {$t("installer.version", { values: { version: overview.version } })}
        </span>
      {/if}
    </div>
  </header>

  {#if release}
    <div class="eris-card flex items-center gap-3 px-4 py-3">
      <Icon icon="lucide:sparkles" class="size-4 shrink-0 text-primary" />

      <span class="grow text-sm">
        {$t("installer.newInstaller", { values: { version: release } })}
      </span>

      <button
        type="button"
        class="btn btn-soft btn-primary btn-sm"
        disabled={updating || phase === "running"}
        onclick={updateInstaller}
      >
        {#if updating}
          <span class="loading loading-spinner loading-xs"></span>
        {/if}

        {$t("installer.getInstaller")}
      </button>
    </div>
  {/if}

  <section class="flex min-h-0 grow flex-col gap-2">
    <h2 class="text-sm font-medium text-base-content/60">{$t("installer.components")}</h2>

    <ul class="flex flex-col gap-2">
      {#each overview.components as c (c.id)}
        {@const step = progress[c.id]}

        <li>
          <label
            class={[
              "eris-card flex items-center gap-3 px-4 py-3",
              c.available && phase === "choose" ? "cursor-pointer" : "opacity-70",
            ]}
          >
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm"
              checked={selected.has(c.id)}
              disabled={!c.available || phase !== "choose"}
              onchange={() => toggle(c.id)}
            />

            <div class="flex size-9 shrink-0 items-center justify-center rounded-field bg-primary/15 text-primary">
              {#if c.id === "eris"}
                <Logo class="size-5" />
              {:else}
                <Icon icon={ICONS[c.id]} class="size-5" />
              {/if}
            </div>

            <div class="flex min-w-0 grow flex-col">
              <span class="text-sm font-semibold">{c.name}</span>

              <span class="truncate text-xs text-base-content/60">
                {step?.state === "failed" ? step.error : $t(`installer.apps.${c.id}`)}
              </span>
            </div>

            {#if step?.state === "running"}
              <span class="loading loading-spinner loading-sm text-primary"></span>
            {:else if step?.state === "done"}
              <Icon icon="lucide:check" class="size-5 text-success" />
            {:else if step?.state === "failed"}
              <Icon icon="lucide:circle-x" class="size-5 text-error" />
            {:else if statusOf(c)}
              <span class="badge badge-soft badge-sm tabular-nums">{statusOf(c)}</span>
            {/if}
          </label>
        </li>
      {/each}
    </ul>

    <p class="text-xs text-base-content/50">{$t("installer.hint")}</p>
  </section>

  <footer class="flex items-center justify-end gap-3">
    {#if phase === "done"}
      <span class={["grow text-sm", failed ? "text-error" : "text-success"]}>
        {$t(failed ? "installer.partial" : "installer.done")}
      </span>

      <button type="button" class="btn btn-primary" onclick={() => getCurrentWindow().close()}>
        {$t("common.close")}
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-primary min-w-28"
        disabled={phase === "running" || chosen.length === 0}
        onclick={install}
      >
        {#if phase === "running"}
          <span class="loading loading-spinner loading-sm"></span>
          {$t("installer.installing")}
        {:else}
          {$t(updatesOnly ? "installer.update" : "installer.install")}
        {/if}
      </button>
    {/if}
  </footer>
</main>
