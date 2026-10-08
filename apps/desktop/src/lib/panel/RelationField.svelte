<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { shortDay } from "$lib/calendar"
  import { type CalendarEvent, type Occurrence, parseLocal } from "$lib/data"
  import type { Panel } from "./panel.svelte"

  type Picking = "parent" | "group" | null

  type Action = { id: "parent" | "child" | "group"; icon: string }

  let {
    panel,
    event,
    parent,
    locked,
    onparent,
  }: {
    panel: Panel
    event: Occurrence | null
    parent: string | null
    locked: boolean
    onparent: (id: string | null) => void
  } = $props()

  let menu = $state(false)
  let picking = $state<Picking>(null)
  let query = $state("")

  const parentEvent = $derived(
    parent ? panel.shown.find(e => e.id === parent) : undefined,
  )

  const children = $derived(
    event && !event.parentId ? panel.childrenOf(event) : [],
  )

  const members = $derived(
    event ? panel.groupOf(event).filter(e => e.id !== event.id) : [],
  )

  const distance = (e: CalendarEvent) =>
    event
      ? Math.abs(parseLocal(e.start).getTime() - parseLocal(event.start).getTime())
      : 0

  const candidates = $derived.by(() => {
    const needle = query.trim().toLowerCase()
    const pool = panel.shown.filter(
      e =>
        e.id !== event?.id &&
        (picking === "parent"
          ? panel.isRoot(e)
          : !members.some(member => member.id === e.id)) &&
        e.title.toLowerCase().includes(needle),
    )

    return pool.toSorted((a, b) => distance(a) - distance(b)).slice(0, 30)
  })

  const actions = $derived<Action[]>([
    ...(!parent && !locked ? [{ id: "parent" as const, icon: "lucide:corner-left-up" }] : []),
    ...(event && !event.parentId ? [{ id: "child" as const, icon: "lucide:corner-down-right" }] : []),
    ...(event ? [{ id: "group" as const, icon: "lucide:group" }] : []),
  ])

  const close = (e: MouseEvent) => {
    if (!(e.target as Element).closest("[data-relation]")) {
      menu = false
      picking = null
    }
  }

  const pick = (target: CalendarEvent) => {
    if (picking === "parent") {
      onparent(target.id)
    } else if (event) {
      panel.groupWith(event, target)
    }

    picking = null
    query = ""
  }

  const act = (id: Action["id"]) => {
    menu = false

    if (id === "child" && event) {
      panel.startChild(event)
    } else if (id !== "child") {
      picking = id
    }
  }
</script>

{#snippet row(icon: string, kind: string, target: CalendarEvent, remove?: () => void)}
  <li class="group/relation flex min-w-0 items-center gap-2 rounded-field px-1 py-0.5 hover:bg-base-content/5">
    <Icon {icon} class="size-3.5 shrink-0 text-base-content/45" />
    <span class="w-7 shrink-0 text-2xs text-base-content/55">{kind}</span>

    <button
      type="button"
      class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left"
      onclick={() => panel.show(target)}
    >
      <span class={["size-1.5 shrink-0 rounded-full", panel.dotTone(target)]}></span>
      <span class="truncate text-sm">{target.title}</span>
      <span class="shrink-0 text-2xs tabular-nums text-base-content/45">
        {shortDay(parseLocal(target.start))}
      </span>
    </button>

    {#if remove}
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs opacity-0 group-hover/relation:opacity-100 focus-visible:opacity-100"
        aria-label={$t("panel.relation.remove")}
        title={$t("panel.relation.remove")}
        onclick={remove}
      >
        <Icon icon="lucide:x" class="size-3" />
      </button>
    {/if}
  </li>
{/snippet}

<svelte:window onmousedown={close} />

<div class="mt-5 flex flex-col gap-1 border-t border-base-300 pt-3" data-relation>
  <div class="relative flex items-center justify-between" data-pop>
    <span class="text-2xs font-medium text-base-content/60">
      {$t("panel.relation.title")}
    </span>

    {#if actions.length > 0}
      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("panel.relation.add")}
        aria-expanded={menu}
        onclick={() => {
          menu = !menu
          picking = null
        }}
      >
        <Icon icon="lucide:plus" class="size-3.5" />
      </button>
    {/if}

    {#if menu}
      <div class="eris-card absolute top-full right-0 z-30 mt-1 flex w-44 flex-col p-1 text-sm">
        {#each actions as action (action.id)}
          <button
            type="button"
            class="flex items-center gap-2 rounded-field px-2 py-1.5 text-left hover:bg-base-content/6"
            onclick={() => act(action.id)}
          >
            <Icon icon={action.icon} class="size-3.5 text-base-content/60" />
            {$t(`panel.relation.actions.${action.id}`)}
          </button>
        {/each}
      </div>
    {/if}

    {#if picking}
      <div class="eris-card absolute top-full right-0 left-0 z-30 mt-1 flex flex-col gap-1 p-1.5 text-sm">
        <input
          class="input input-sm w-full"
          placeholder={$t("panel.relation.search")}
          bind:value={query}
          {@attach node => node.focus()}
          onkeydown={e => e.key === "Escape" && (picking = null)}
        />

        <ul class="flex max-h-48 flex-col overflow-y-auto">
          {#each candidates as candidate (candidate.id)}
            <li>
              <button
                type="button"
                class="flex w-full min-w-0 items-center gap-2 rounded-field px-2 py-1 text-left hover:bg-base-content/6"
                onclick={() => pick(candidate)}
              >
                <span class={["size-1.5 shrink-0 rounded-full", panel.dotTone(candidate)]}></span>
                <span class="truncate">{candidate.title}</span>
                <span class="ml-auto shrink-0 text-2xs tabular-nums text-base-content/45">
                  {shortDay(parseLocal(candidate.start))}
                </span>
              </button>
            </li>
          {:else}
            <li class="px-2 py-1 text-2xs text-base-content/45">{$t("panel.relation.empty")}</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if parentEvent || children.length > 0 || members.length > 0}
    <ul class="-mx-1 flex flex-col">
      {#if parentEvent}
        {@render row("lucide:corner-left-up", $t("panel.relation.parent"), parentEvent, () => onparent(null))}
      {/if}

      {#each children as child (child.id)}
        {@render row("lucide:corner-down-right", $t("panel.relation.child"), child)}
      {/each}

      {#each members as member (member.id)}
        {@render row("lucide:group", $t("panel.relation.group"), member, () => panel.ungroup(member))}
      {/each}
    </ul>
  {/if}
</div>
