<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { appIcon } from "$lib/apps"
  import type { Launcher } from "./launcher.svelte"
  import ResultRow from "./ResultRow.svelte"

  let { launcher }: { launcher: Launcher } = $props()

  const route = $derived(launcher.route)

  const emptyMessage = $derived.by(() => {
    if (route.mode === "timer") {
      return $t(route.kind === "alarm" ? "launcher.empty.alarm" : "launcher.empty.timer")
    }

    if (route.mode === "run" || route.mode === "todo" || route.mode === "calc" || route.mode === "emoji") {
      return $t(`launcher.empty.${route.mode}`)
    }

    if (route.mode === "clip" && !route.text) {
      return $t("launcher.empty.clip")
    }

    if (route.text) {
      return $t("launcher.empty.noResults")
    }

    return launcher.apps.length ? $t("launcher.empty.start") : $t("launcher.empty.loading")
  })

  $effect(() => {
    for (const item of launcher.flat) {
      const path = item.iconPath

      if (!path || item.icon.startsWith("data:")) {
        continue
      }

      appIcon(path).then(icon => {
        if (icon) {
          launcher.icons[path] = icon
        }
      })
    }
  })

  $effect(() => {
    launcher.list
      ?.querySelector(`[data-index="${launcher.active}"]`)
      ?.scrollIntoView({ block: "nearest" })
  })
</script>

<div
  bind:this={launcher.list}
  role="listbox"
  aria-label={$t("launcher.results")}
  tabindex="-1"
  class={["min-h-0 grow overflow-y-auto", launcher.compact ? "p-1" : "p-1.5"]}
>
  {#each launcher.groups as group (group.label)}
    <div
      class={[
        "flex items-center justify-between px-3 text-xs font-medium text-base-content/50",
        launcher.compact ? "pt-1.5 pb-0.5" : "pt-2 pb-1",
      ]}
    >
      <span>{group.label}</span>
      <span class="tabular-nums">{group.items.length}</span>
    </div>

    {#each group.items as item, j (item.id)}
      <ResultRow {launcher} {item} index={group.start + j} />
    {/each}
  {:else}
    <div
      class="flex h-full flex-col items-center justify-center gap-2 text-base-content/50"
    >
      <Icon
        icon={route.text || route.mode !== "search"
          ? "lucide:search-x"
          : "lucide:sparkles"}
        class="size-7 opacity-50"
      />

      <p class="text-sm">{emptyMessage}</p>
    </div>
  {/each}
</div>
