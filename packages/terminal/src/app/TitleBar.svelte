<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Logo } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { closeTab, openTab, session } from "./tabs.svelte"
  import WindowControls from "./WindowControls.svelte"

  let { fallback }: { fallback: string } = $props()
</script>

<header
  data-tauri-drag-region
  class="flex h-10 shrink-0 items-stretch bg-base-300/60 select-none"
>
  <div data-tauri-drag-region class="flex items-center pr-1 pl-3">
    <Logo class="pointer-events-none size-4" />
  </div>

  <div
    role="tablist"
    aria-label={$t("terminal.tabs.list")}
    class="flex min-w-0 items-end gap-0.5 overflow-hidden pt-1.5 pl-1"
  >
    {#each session.tabs as tab, index (tab.id)}
      {@const active = index === session.active}

      <div
        role="tab"
        tabindex="-1"
        aria-selected={active}
        title={tab.title}
        class={[
          "group flex h-full w-52 min-w-24 cursor-pointer items-center gap-2",
          "rounded-t-field px-3 text-sm transition-colors",
          active
            ? "bg-base-100 text-base-content"
            : "text-base-content/70 hover:bg-base-content/5",
        ]}
        onclick={() => (session.active = index)}
        onauxclick={e => e.button === 1 && closeTab(index)}
        onkeydown={() => undefined}
      >
        <Icon icon="lucide:square-terminal" class="size-4 shrink-0" />

        <span class="min-w-0 grow truncate">{tab.title}</span>

        <button
          type="button"
          class={[
            "btn btn-ghost btn-square btn-xs shrink-0",
            !active && "opacity-0 group-hover:opacity-100",
          ]}
          aria-label={$t("terminal.tabs.close")}
          onclick={e => {
            e.stopPropagation()
            closeTab(index)
          }}
        >
          <Icon icon="lucide:x" class="size-3.5" />
        </button>
      </div>
    {/each}
  </div>

  <div class="flex items-center gap-0.5 px-1">
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={$t("terminal.tabs.new")}
      title={$t("terminal.tabs.new")}
      onclick={() => openTab(fallback)}
    >
      <Icon icon="lucide:plus" class="size-4" />
    </button>

    <div class="dropdown dropdown-end">
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={$t("terminal.tabs.shells")}
        title={$t("terminal.tabs.shells")}
      >
        <Icon icon="lucide:chevron-down" class="size-4" />
      </button>

      <ul
        class={[
          "dropdown-content menu z-10 mt-1 w-56 rounded-box border",
          "border-base-content/10 bg-base-200 p-1 shadow-lg",
        ]}
      >
        {#each session.shells as shell (shell.id)}
          <li>
            <button
              type="button"
              onclick={e => {
                e.currentTarget.blur()
                openTab(shell.id)
              }}
            >
              <Icon icon="lucide:square-terminal" class="size-4" />
              {shell.name}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div data-tauri-drag-region class="grow"></div>

  <button
    type="button"
    class="btn btn-ghost h-full rounded-none border-0 px-3"
    aria-label={$t("terminal.settings.title")}
    title={$t("terminal.settings.title")}
    onclick={() => (session.settingsOpen = true)}
  >
    <Icon icon="lucide:settings" class="size-4" />
  </button>

  <WindowControls />
</header>
