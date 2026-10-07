<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import {
    COMMANDS,
    type CommandId,
    hintOf,
    usable,
  } from "../../store/commands"
  import type { Explorer } from "../../store/explorer.svelte"
  import { NETWORK_ACTIONS } from "../../store/menus"
  import {
    GROUP_KEYS,
    prefs,
    SORT_KEYS,
    VIEW_ICONS,
    VIEWS,
  } from "../../store/prefs.svelte"
  import { THIS_PC } from "../../locations"
  import CommandButton from "./CommandButton.svelte"

  let { explorer, compact = false }: { explorer: Explorer; compact?: boolean } =
    $props()

  const MENU = [
    "dropdown-content menu z-30 mt-1 w-60 gap-0.5 rounded-box border",
    "border-base-content/10 bg-base-100 p-2 shadow-xl",
  ]

  const EDIT: CommandId[] = ["cut", "copy", "paste", "rename", "delete"]

  const SELECTION: CommandId[] = ["selectAll", "selectNone", "invertSelection"]

  const OTHERS: CommandId[] = ["properties", "newWindow", "shared", "settings"]

  const more = $derived(
    prefs.selectionInMore || compact ? [SELECTION, OTHERS] : [OTHERS],
  )

  const folder = $derived(explorer.folder)

  const done = () => (document.activeElement as HTMLElement | null)?.blur()

  const pick = (run: () => unknown) => () => {
    run()
    done()
  }
</script>

{#snippet option(
  label: string,
  run: () => unknown,
  extra: { icon?: string; hint?: string; active?: boolean; disabled?: boolean },
)}
  <li class={[extra.disabled && "menu-disabled"]}>
    <button
      type="button"
      class={[extra.active && "menu-active"]}
      disabled={extra.disabled}
      onclick={pick(run)}
    >
      {#if extra.icon}
        <Icon icon={extra.icon} class="size-4" />
      {/if}

      {label}

      {#if extra.hint}
        <span class="ml-auto text-xs text-base-content/40">{extra.hint}</span>
      {/if}
    </button>
  </li>
{/snippet}

{#snippet command(id: CommandId)}
  {@render option($t(COMMANDS[id].label), () => COMMANDS[id].run(explorer), {
    icon: COMMANDS[id].icon,
    hint: hintOf(id),
    disabled: !usable(id, explorer),
  })}
{/snippet}

{#snippet separator()}
  <li class="mx-1 my-1 border-t border-base-content/10" role="separator"></li>
{/snippet}

{#snippet moreMenu()}
  <div class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={$t("explorer.commands.more")}
    >
      <Icon icon="lucide:ellipsis" class="size-4" />
    </div>

    <ul tabindex="-1" class={MENU}>
      {#if explorer.tab.location === THIS_PC}
        {#each NETWORK_ACTIONS as entry (entry.key)}
          {@render option(
            $t(`explorer.commands.${entry.key}`),
            () => explorer.changePlaces(entry.run),
            { icon: entry.icon },
          )}
        {/each}

        {@render separator()}
      {/if}

      {#each more as group, index (index)}
        {#if index > 0}
          {@render separator()}
        {/if}

        {#each group as id (id)}
          {@render command(id)}
        {/each}
      {/each}
    </ul>
  </div>
{/snippet}

{#if compact}
  <CommandButton id="preview" {explorer} pressed={prefs.preview} />

  {@render moreMenu()}
{:else}
  <div
    class={[
      "flex shrink-0 items-center gap-0.5 border-b border-base-content/10",
      "px-2 pb-1.5",
    ]}
  >
    {#if explorer.inBin}
      <CommandButton id="emptyBin" {explorer} text />

      <CommandButton id="restore" {explorer} text />
    {:else}
      <CommandButton id="newFolder" {explorer} text />
    {/if}

    <div class="mx-1 h-5 border-l border-base-content/10"></div>

    {#each EDIT as id (id)}
      <CommandButton {id} {explorer} />
    {/each}

    <div class="mx-1 h-5 border-l border-base-content/10"></div>

    <div class="dropdown">
      <div
        tabindex={explorer.arrangeable ? 0 : -1}
        role="button"
        aria-disabled={!explorer.arrangeable}
        class={[
          "btn btn-ghost btn-sm gap-2",
          !explorer.arrangeable && "btn-disabled",
        ]}
      >
        <Icon icon="lucide:arrow-up-down" class="size-4" />
        {$t("explorer.commands.sort")}
        <Icon icon="lucide:chevron-down" class="size-3.5 opacity-60" />
      </div>

      <ul tabindex="-1" class={MENU}>
        {#each SORT_KEYS as key (key)}
          {@render option(
            $t(`explorer.sort.${key}`),
            () => explorer.setSort(key, folder.ascending),
            { active: folder.sort === key },
          )}
        {/each}

        {@render separator()}

        {@render option(
          $t("explorer.sort.ascending"),
          () => explorer.setSort(folder.sort, true),
          { icon: "lucide:arrow-up-narrow-wide", active: folder.ascending },
        )}

        {@render option(
          $t("explorer.sort.descending"),
          () => explorer.setSort(folder.sort, false),
          { icon: "lucide:arrow-down-wide-narrow", active: !folder.ascending },
        )}

        {@render separator()}

        <li class="menu-title">{$t("explorer.groups.title")}</li>

        {#each GROUP_KEYS as key (key)}
          {@render option(
            $t(`explorer.groups.by.${key}`),
            () => explorer.setGroup(key),
            { active: explorer.group === key },
          )}
        {/each}
      </ul>
    </div>

    <div class="dropdown">
      <div tabindex="0" role="button" class="btn btn-ghost btn-sm gap-2">
        <Icon icon={VIEW_ICONS[explorer.view]} class="size-4" />
        {$t("explorer.commands.view")}
        <Icon icon="lucide:chevron-down" class="size-3.5 opacity-60" />
      </div>

      <ul tabindex="-1" class={MENU}>
        {#each VIEWS as view (view)}
          {@render option(
            $t(`explorer.views.${view}`),
            () => explorer.setView(view),
            {
              icon: VIEW_ICONS[view],
              hint: hintOf(`view.${view}`),
              active: explorer.view === view,
              disabled: !explorer.arrangeable,
            },
          )}
        {/each}

        {@render separator()}

        <li class={[!explorer.arrangeable && "menu-disabled"]}>
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-xs"
              checked={explorer.group === "modified"}
              disabled={!explorer.arrangeable}
              onchange={() => explorer.toggleDateGroups()}
            />
            {$t("explorer.views.dateGroups")}
          </label>
        </li>

        <li class={[!explorer.arrangeable && "menu-disabled"]}>
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-xs"
              checked={!!explorer.own}
              disabled={!explorer.arrangeable}
              onchange={() => explorer.toggleFolderOnly()}
            />
            {$t("explorer.views.folderOnly")}
          </label>
        </li>

        <li>
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-xs"
              bind:checked={prefs.showHidden}
            />
            {$t("explorer.views.hidden")}
          </label>
        </li>

        <li>
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-xs"
              bind:checked={prefs.showExtensions}
            />
            {$t("explorer.views.extensions")}
          </label>
        </li>
      </ul>
    </div>

    <div class="grow"></div>

    {#if !prefs.selectionInMore}
      {#each SELECTION as id (id)}
        <CommandButton {id} {explorer} />
      {/each}
    {/if}

    <CommandButton id="preview" {explorer} pressed={prefs.preview} />

    {@render moreMenu()}
  </div>
{/if}
