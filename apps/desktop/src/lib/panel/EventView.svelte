<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { eventSpan, longDay, shortDay, tagLabel, tagsOf } from "$lib/calendar"
  import { type Occurrence, parseLocal, shiftable } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import NoteText from "./NoteText.svelte"
  import type { Panel } from "./panel.svelte"

  const { panel, event }: { panel: Panel; event: Occurrence } = $props()

  const meta = $derived(colorMeta[toColor(event.color)])

  const tags = $derived(tagsOf(panel.profile.calendar.tags, event))

  const parent = $derived(panel.parentOf(event))

  const children = $derived(panel.childrenOf(event))
</script>

{#snippet row(label: string)}
  <dt class="w-20 shrink-0 text-base-content/60">{label}</dt>
{/snippet}

<div class="flex items-start gap-2.5">
  <span class={["mt-2 size-2.5 shrink-0 rounded-full", meta.chip]}></span>
  <h3 class="text-xl leading-tight font-semibold break-words text-balance">
    {event.title}
  </h3>
</div>

<dl class="mt-5 flex flex-col gap-2.5 text-sm">
  <div class="flex gap-3">
    {@render row($t("panel.detail.date"))}
    <dd class="min-w-0">{longDay(parseLocal(event.start))}</dd>
  </div>

  <div class="flex gap-3">
    {@render row($t("panel.detail.time"))}
    <dd class="flex min-w-0 flex-col tabular-nums">
      {eventSpan(event, $t("panel.allDay"))}

      {#if event.shiftedFrom}
        <span class="text-2xs text-warning">
          {$t("panel.event.movedFrom", {
            values: { date: shortDay(parseLocal(event.shiftedFrom)) },
          })}
        </span>
      {/if}
    </dd>
  </div>

  <div class="flex gap-3">
    {@render row($t("panel.event.repeat"))}
    <dd class="min-w-0">
      {$t(`panel.event.recurrences.${event.recurrence}`)}
    </dd>
  </div>

  {#if shiftable(event.recurrence) && event.shift}
    <div class="flex gap-3">
      {@render row($t("panel.event.shiftShort"))}
      <dd class="min-w-0">{$t(`panel.event.shifts.${event.shift}`)}</dd>
    </div>
  {/if}

  <div class="flex gap-3">
    {@render row($t("panel.event.color"))}
    <dd class="flex min-w-0 items-center gap-2">
      <span class={["size-2 rounded-full", meta.chip]}></span>
      {$t(meta.label)}
    </dd>
  </div>

  {#if tags.length > 0}
    <div class="flex gap-3">
      {@render row($t("panel.event.tags"))}
      <dd class="flex min-w-0 flex-wrap gap-1">
        {#each tags as tag (tag.id)}
          <span class="badge badge-sm badge-ghost gap-1">
            {#if tag.hideWhileSharing}
              <Icon icon="lucide:eye-off" class="size-3" />
            {/if}
            {tagLabel(tag)}
          </span>
        {/each}
      </dd>
    </div>
  {/if}

  {#if parent}
    <div class="flex gap-3">
      {@render row($t("panel.event.parent"))}
      <dd class="min-w-0">
        <button
          type="button"
          class="link link-hover text-left break-words"
          onclick={() => panel.show(parent)}
        >
          {parent.title}
        </button>
      </dd>
    </div>
  {/if}
</dl>

{#if !parent}
  <div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
    <span class="text-2xs font-medium text-base-content/60">
      {$t("panel.event.children")}
    </span>

    {#if children.length > 0}
      <ul class="-mx-2 flex flex-col">
        {#each children as child (child.id)}
          {@const childMeta = colorMeta[toColor(child.color)]}
          <li>
            <button
              type="button"
              class={[
                "flex w-full cursor-pointer items-start gap-2.5 rounded-field",
                "px-2 py-1.5 text-left transition-colors duration-120",
                "hover:bg-base-content/5",
              ]}
              onclick={() => panel.show(child)}
            >
              <span
                class={["mt-1.5 size-2 shrink-0 rounded-full", childMeta.chip]}
              ></span>
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm font-medium break-words">
                  {child.title}
                </span>
                <span class="text-2xs tabular-nums text-base-content/60">
                  {shortDay(parseLocal(child.start))}
                  {eventSpan(child, $t("panel.allDay"))}
                </span>
              </span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}

    <button
      type="button"
      class="btn btn-ghost btn-sm justify-start"
      onclick={() => panel.startChild(event)}
    >
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.event.addChild")}
    </button>
  </div>
{/if}

<div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
  <span class="text-2xs font-medium text-base-content/60">
    {$t("panel.event.notes")}
  </span>

  {#if event.notes}
    <NoteText text={event.notes} />
  {:else}
    <p class="text-sm leading-relaxed text-base-content/50">
      {$t("panel.event.noNotes")}
    </p>
  {/if}
</div>
