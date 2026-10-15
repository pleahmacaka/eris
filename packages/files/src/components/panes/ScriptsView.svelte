<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { type PackageScripts, packageScripts } from "../../native"
  import {
    fallbackManager,
    loadManagers,
    runInTerminal,
    scriptCommand,
  } from "../../store/terminal.svelte"

  let { dir }: { dir: string } = $props()

  let found = $state<PackageScripts | null>(null)

  const MANAGER_ICONS: Record<string, string> = {
    bun: "material-icon-theme:bun",
    pnpm: "material-icon-theme:pnpm",
    yarn: "material-icon-theme:yarn",
    npm: "material-icon-theme:npm",
    deno: "material-icon-theme:deno",
  }

  const manager = $derived(found?.manager ?? fallbackManager())

  $effect(() => {
    loadManagers()
  })

  $effect(() => {
    const target = dir
    let live = true

    packageScripts(target)
      .catch(() => null)
      .then(value => {
        if (live) {
          found = value
        }
      })

    return () => {
      live = false
    }
  })
</script>

<div class="flex min-h-0 grow flex-col gap-2">
  <div class="flex shrink-0 items-center gap-2 px-1 text-xs text-base-content/60">
    <Icon icon={MANAGER_ICONS[manager] ?? "material-icon-theme:nodejs"} class="size-4" />

    <span class="truncate">
      {$t(found?.manager ? "explorer.scripts.detected" : "explorer.scripts.fallback", {
        values: { manager },
      })}
    </span>
  </div>

  {#if found && found.scripts.length > 0}
    <ul class="flex min-h-0 grow flex-col gap-1 overflow-y-auto">
      {#each found.scripts as script (script.name)}
        <li>
          <button
            type="button"
            class={[
              "group flex w-full cursor-pointer items-center gap-2 rounded-field",
              "px-2 py-1.5 text-left transition-colors hover:bg-base-content/5",
            ]}
            title={scriptCommand(manager, script.name)}
            onclick={() => runInTerminal(dir, scriptCommand(manager, script.name))}
          >
            <Icon
              icon="lucide:play"
              class="size-3.5 shrink-0 text-success opacity-60 group-hover:opacity-100"
            />

            <span class="flex min-w-0 grow flex-col">
              <span class="truncate text-sm font-medium">{script.name}</span>
              <span class="truncate text-xs text-base-content/50">{script.command}</span>
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else if found}
    <p class="px-1 text-sm text-base-content/50">{$t("explorer.scripts.empty")}</p>
  {/if}
</div>
