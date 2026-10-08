<script lang="ts">
  import Icon from "@iconify/svelte"
  import { type MenuItem, openContextMenu } from "@eris/ui"
  import { t } from "svelte-i18n"
  import {
    drag,
    justDragged,
    pressTab,
    SLOP,
    springTo,
    unspring,
  } from "./drag.svelte"
  import { type Pane, panesOf } from "./layout"
  import {
    closePane,
    closeTab,
    detachPane,
    openTab,
    paneLabel,
    session,
    type Tab,
    ungroup,
  } from "./tabs.svelte"

  type Renaming = { kind: "tab" | "pane"; id: number }

  let renaming = $state<Renaming | null>(null)
  let pulling = $state<number | null>(null)
  let pulled = false

  const groupName = (tab: Tab) => tab.name || $t("terminal.tabs.workspace")

  const isRenaming = (kind: Renaming["kind"], id: number) =>
    renaming?.kind === kind && renaming.id === id

  const menu = (e: MouseEvent, items: MenuItem[]) => {
    e.preventDefault()
    openContextMenu({ items, x: e.clientX, y: e.clientY })
  }

  const commitName = (value: string) => {
    const target = renaming

    renaming = null

    if (!target) {
      return
    }

    const name = value.trim() || undefined

    if (target.kind === "tab") {
      const tab = session.tabs.find(entry => entry.id === target.id)

      if (tab) {
        tab.name = name
      }

      return
    }

    for (const tab of session.tabs) {
      const pane = panesOf(tab.root).find(entry => entry.id === target.id)

      if (pane) {
        pane.name = name
      }
    }
  }

  const pressPane = (e: PointerEvent, pane: Pane) => {
    if (e.button !== 0) {
      return
    }

    const group = (e.currentTarget as HTMLElement).closest("[data-group]")
    const startX = e.clientX
    const startY = e.clientY

    const move = (m: PointerEvent) => {
      if (pulling === null && Math.hypot(m.clientX - startX, m.clientY - startY) >= SLOP) {
        pulling = pane.id
      }
    }

    const up = (u: PointerEvent) => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)

      if (pulling === null) {
        return
      }

      pulling = null
      pulled = true
      setTimeout(() => {
        pulled = false
      })

      if (!group?.contains(document.elementFromPoint(u.clientX, u.clientY))) {
        detachPane(pane.id)
      }
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const renameItem = (target: Renaming): MenuItem => ({
    label: $t("terminal.tabs.rename"),
    icon: "lucide:pencil",
    action: () => (renaming = target),
  })
</script>

{#snippet nameField(value: string)}
  <input
    class="input input-xs h-6 w-full min-w-0 grow px-1.5"
    aria-label={$t("terminal.tabs.rename")}
    spellcheck="false"
    {value}
    {@attach node => {
      node.focus()
      node.select()
    }}
    onclick={e => e.stopPropagation()}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
    onblur={e => commitName(e.currentTarget.value)}
    onkeydown={e => {
      if (e.key === "Enter") {
        e.currentTarget.blur()
      } else if (e.key === "Escape") {
        renaming = null
      }
    }}
  />
{/snippet}

{#snippet closeButton(label: string, close: () => void, shown: boolean)}
  <button
    type="button"
    class={[
      "btn btn-ghost btn-square btn-xs shrink-0",
      !shown && "opacity-0 group-hover/tab:opacity-100",
    ]}
    aria-label={label}
    onclick={e => {
      e.stopPropagation()
      close()
    }}
  >
    <Icon icon="lucide:x" class="size-3.5" />
  </button>
{/snippet}

<div
  role="tablist"
  aria-label={$t("terminal.tabs.list")}
  class="flex min-w-0 items-end gap-0.5 overflow-hidden pt-1.5 pl-1"
>
  {#each session.tabs as tab, index (tab.id)}
    {@const active = index === session.active}
    {@const panes = panesOf(tab.root)}

    {#if panes.length === 1}
      {@const pane = panes[0]}

      <div
        role="tab"
        tabindex="-1"
        aria-selected={active}
        title={paneLabel(pane)}
        class={[
          "group/tab flex h-full w-52 min-w-24 cursor-pointer items-center gap-2",
          "rounded-t-field px-3 text-sm transition-colors",
          active
            ? "bg-base-100 text-base-content"
            : "text-base-content/70 hover:bg-base-content/5",
          drag.tab === tab.id && "opacity-50",
        ]}
        onpointerdown={e => pressTab(e, tab.id)}
        onpointerenter={() => springTo(tab.id, () => (session.active = index))}
        onpointerleave={unspring}
        onclick={() => {
          if (!justDragged()) {
            session.active = index
          }
        }}
        ondblclick={() => (renaming = { kind: "pane", id: pane.id })}
        oncontextmenu={e =>
          menu(e, [
            renameItem({ kind: "pane", id: pane.id }),
            "separator",
            {
              label: $t("terminal.tabs.close"),
              icon: "lucide:x",
              action: () => closeTab(index),
            },
          ])}
        onauxclick={e => e.button === 1 && closeTab(index)}
        onkeydown={() => undefined}
      >
        <Icon icon="lucide:square-terminal" class="size-4 shrink-0" />

        {#if isRenaming("pane", pane.id)}
          {@render nameField(paneLabel(pane))}
        {:else}
          <span class="min-w-0 grow truncate">{paneLabel(pane)}</span>
        {/if}

        {@render closeButton($t("terminal.tabs.close"), () => closeTab(index), active)}
      </div>
    {:else}
      <div
        data-group
        role="group"
        aria-label={$t("terminal.tabs.group", { values: { name: groupName(tab) } })}
        class={[
          "relative flex h-full min-w-0 shrink items-end gap-0.5 px-0.5",
          drag.tab === tab.id && "opacity-50",
        ]}
        onpointerenter={() => springTo(tab.id, () => (session.active = index))}
        onpointerleave={unspring}
      >
        <div
          role="button"
          tabindex="0"
          title={groupName(tab)}
          class={[
            "flex shrink-0 cursor-pointer items-center rounded-field",
            "text-xs font-semibold transition-colors",
            isRenaming("tab", tab.id)
              ? "mb-1 h-7 w-44 px-0.5"
              : "mb-1.5 h-6 max-w-40 px-2",
            active
              ? "bg-primary text-primary-content"
              : "bg-primary/20 text-primary hover:bg-primary/30",
          ]}
          onpointerdown={e => pressTab(e, tab.id)}
          onclick={() => {
            if (!justDragged()) {
              session.active = index
            }
          }}
          ondblclick={() => (renaming = { kind: "tab", id: tab.id })}
          oncontextmenu={e =>
            menu(e, [
              renameItem({ kind: "tab", id: tab.id }),
              {
                label: $t("terminal.tabs.ungroup"),
                icon: "lucide:ungroup",
                action: () => ungroup(tab),
              },
              "separator",
              {
                label: $t("terminal.tabs.close"),
                icon: "lucide:x",
                action: () => closeTab(index),
              },
            ])}
          onkeydown={e => e.key === "Enter" && (session.active = index)}
        >
          {#if isRenaming("tab", tab.id)}
            {@render nameField(groupName(tab))}
          {:else}
            <span class="truncate">@{groupName(tab)}</span>
          {/if}
        </div>

        {#each panes as pane (pane.id)}
          {@const current = active && tab.focus === pane.id}

          <div
            role="tab"
            tabindex="-1"
            aria-selected={current}
            title={paneLabel(pane)}
            class={[
              "group/tab flex h-full w-40 min-w-20 cursor-pointer items-center gap-2",
              "rounded-t-field px-2.5 text-sm transition-colors",
              current
                ? "bg-base-100 text-base-content"
                : active
                  ? "bg-base-100/50 text-base-content/80 hover:bg-base-100/80"
                  : "text-base-content/70 hover:bg-base-content/5",
              pulling === pane.id && "opacity-50",
            ]}
            onpointerdown={e => pressPane(e, pane)}
            onclick={() => {
              if (!pulled) {
                session.active = index
                tab.focus = pane.id
              }
            }}
            ondblclick={() => (renaming = { kind: "pane", id: pane.id })}
            oncontextmenu={e =>
              menu(e, [
                {
                  label: $t("terminal.tabs.detach"),
                  icon: "lucide:square-arrow-out-up-right",
                  action: () => detachPane(pane.id),
                },
                renameItem({ kind: "pane", id: pane.id }),
                "separator",
                {
                  label: $t("terminal.tabs.closePane"),
                  icon: "lucide:x",
                  action: () => closePane(pane.id),
                },
              ])}
            onauxclick={e => e.button === 1 && closePane(pane.id)}
            onkeydown={() => undefined}
          >
            <Icon icon="lucide:square-terminal" class="size-4 shrink-0" />

            {#if isRenaming("pane", pane.id)}
              {@render nameField(paneLabel(pane))}
            {:else}
              <span class="min-w-0 grow truncate">{paneLabel(pane)}</span>
            {/if}

            {@render closeButton($t("terminal.tabs.closePane"), () => closePane(pane.id), current)}
          </div>
        {/each}

        <span
          class={[
            "pointer-events-none absolute inset-x-0.5 bottom-0 h-0.5 rounded-full",
            active ? "bg-primary" : "bg-primary/50",
          ]}
        ></span>
      </div>
    {/if}
  {/each}
</div>

<div class="flex items-center gap-0.5 px-1">
  <button
    type="button"
    class="btn btn-ghost btn-square btn-sm"
    aria-label={$t("terminal.tabs.new")}
    title={$t("terminal.tabs.new")}
    onclick={() => openTab()}
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
              openTab({ shell: shell.id })
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
