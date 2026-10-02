<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import ItemIcon from "../items/ItemIcon.svelte"
  import type { Explorer } from "../../store/explorer.svelte"
  import WindowControls from "./WindowControls.svelte"

  let { explorer }: { explorer: Explorer } = $props()
</script>

<header
  data-tauri-drag-region
  class="flex h-10 shrink-0 items-stretch bg-base-300/60 select-none"
>
  <div
    role="tablist"
    aria-label={$t("explorer.tabs.list")}
    class="flex min-w-0 items-end gap-0.5 overflow-hidden pt-1.5 pl-2"
  >
    {#each explorer.tabs as tab, index (tab.id)}
      {@const active = index === explorer.active}

      <div
        role="tab"
        tabindex="-1"
        aria-selected={active}
        title={explorer.title(tab, $t)}
        class={[
          "group flex h-full w-60 min-w-24 cursor-pointer items-center gap-2",
          "rounded-t-field px-3 text-sm transition-colors",
          active
            ? "bg-base-100 text-base-content"
            : "text-base-content/70 hover:bg-base-content/5",
        ]}
        onclick={() => (explorer.active = index)}
        onauxclick={e => e.button === 1 && explorer.close(index)}
        onkeydown={() => undefined}
      >
        <ItemIcon source={tab.location} rem={1} class="size-4 shrink-0" />

        <span class="min-w-0 grow truncate">{explorer.title(tab, $t)}</span>

        <button
          type="button"
          class={[
            "btn btn-ghost btn-square btn-xs shrink-0",
            !active && "opacity-0 group-hover:opacity-100",
          ]}
          aria-label={$t("explorer.tabs.close")}
          onclick={e => {
            e.stopPropagation()
            explorer.close(index)
          }}
        >
          <Icon icon="lucide:x" class="size-3.5" />
        </button>
      </div>
    {/each}
  </div>

  <div class="flex items-center px-1">
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={$t("explorer.tabs.new")}
      title={$t("explorer.tabs.new")}
      onclick={() => explorer.newTab()}
    >
      <Icon icon="lucide:plus" class="size-4" />
    </button>
  </div>

  <div data-tauri-drag-region class="grow"></div>

  <WindowControls />
</header>
