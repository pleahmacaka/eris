<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { hostOf } from "../../hosts"
  import { type FolderPane, prefs } from "../../store/prefs.svelte"
  import type { Tab } from "../../store/tab.svelte"
  import GitPanel from "./GitPanel.svelte"
  import ReadmeView from "./ReadmeView.svelte"
  import ScriptsView from "./ScriptsView.svelte"

  let { tab }: { tab: Tab } = $props()

  const README_NAMES = [
    "readme.md",
    "readme.markdown",
    "readme",
    "readme.txt",
    "readme.rst",
  ]

  const MODES: [FolderPane, string][] = [
    ["readme", "lucide:book-open"],
    ["git", "lucide:git-branch"],
    ["scripts", "material-icon-theme:nodejs"],
  ]

  const repo = $derived(tab.insight.view.repo)

  const host = $derived(hostOf(repo?.head, prefs.gitHosts))

  const readme = $derived(
    tab.kind === "folder"
      ? README_NAMES.map(name =>
          tab.items.find(item => !item.dir && item.name.toLowerCase() === name),
        ).find(Boolean)
      : undefined,
  )

  const manifest = $derived(
    tab.kind === "folder"
      ? tab.items.find(item => !item.dir && item.name.toLowerCase() === "package.json")
      : undefined,
  )

  const shown: Record<FolderPane, () => boolean> = {
    readme: () => !!readme,
    git: () => !!repo,
    scripts: () => !!manifest,
  }

  const available = $derived(MODES.filter(([mode]) => shown[mode]()))

  const mode = $derived(
    available.find(([id]) => id === prefs.folderPane)?.[0] ??
      available[0]?.[0] ??
      null,
  )
</script>

{#if mode}
  <div class="flex shrink-0 items-center gap-1">
    {#each available as [id, icon] (id)}
      <button
        type="button"
        class={[
          "btn btn-square btn-sm",
          mode === id ? "btn-soft btn-primary" : "btn-ghost",
        ]}
        title={id === "git" && host.name ? host.name : $t(`explorer.folderPane.${id}`)}
        aria-label={$t(`explorer.folderPane.${id}`)}
        aria-pressed={mode === id}
        onclick={() => (prefs.folderPane = id)}
      >
        <Icon icon={id === "git" ? host.icon : icon} class="size-4" />
      </button>
    {/each}

    {#if mode === "readme"}
      <button
        type="button"
        class="btn btn-ghost btn-sm ml-auto"
        aria-pressed={prefs.readmeRaw}
        onclick={() => (prefs.readmeRaw = !prefs.readmeRaw)}
      >
        <Icon icon={prefs.readmeRaw ? "lucide:eye" : "lucide:code"} class="size-4" />

        {$t(prefs.readmeRaw ? "explorer.folderPane.rendered" : "explorer.folderPane.raw")}
      </button>
    {/if}
  </div>

  <div class="flex min-h-0 grow flex-col overflow-hidden rounded-box bg-base-content/5 p-2">
    {#if mode === "git" && repo}
      <GitPanel insight={tab.insight} />
    {:else if mode === "scripts" && manifest}
      {#key manifest.modified}
        <ScriptsView dir={tab.location} />
      {/key}
    {:else if readme}
      <ReadmeView path={readme.path} name={readme.name} raw={prefs.readmeRaw} />
    {/if}
  </div>
{:else}
  <div
    class={[
      "flex grow items-center justify-center px-4 text-center text-sm",
      "text-base-content/50",
    ]}
  >
    {$t("explorer.states.selectToPreview")}
  </div>
{/if}
