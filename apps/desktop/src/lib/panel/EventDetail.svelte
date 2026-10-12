<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { isDone } from "#lib/data/index.js"
  import { colorMeta } from "./colors"
  import { finalTitle } from "./draft"
  import { editingState } from "./editing.svelte"
  import EventFields from "./EventFields.svelte"
  import EventNotes from "./EventNotes.svelte"
  import type { Panel } from "./panel.svelte"
  import RelationField from "./RelationField.svelte"
  import ScopeSheet from "./ScopeSheet.svelte"

  const { panel }: { panel: Panel } = $props()
  const editor = editingState(untrack(() => panel))
  const draft = $derived(editor.draft)
  const event = $derived(panel.openEvent)
  const meta = $derived(colorMeta[panel.colorOf(draft.tags)])
  const done = $derived(event ? isDone(event) : false)
  const locked = $derived(event !== null && panel.hasChildren(event))

  $effect(() => {
    const idle = requestIdleCallback(() => import("@eris/live-editor"))

    return () => cancelIdleCallback(idle)
  })

  const titleKey = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col select-text">
  <header class="flex min-h-14 items-center gap-2 border-b border-base-300 px-3 py-3">
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs"
      aria-label={$t("common.back")}
      onclick={panel.close}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <span class="flex-1"></span>

    {#if event}
      <button
        class="btn btn-ghost btn-square btn-xs text-error"
        aria-label={$t("common.delete")}
        onclick={() => panel.remove(event)}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    {/if}
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    <div class="flex items-start gap-2.5">
      {#if draft.task && event}
        <input
          type="checkbox"
          class="checkbox checkbox-primary checkbox-sm mt-1.5 shrink-0"
          checked={done}
          aria-label={$t(done ? "panel.task.undo" : "panel.task.done")}
          onchange={() => panel.toggleDone(event)}
        />
      {:else}
        <span class={["mt-2.5 size-2.5 shrink-0 rounded-full", meta.chip]}></span>
      {/if}

      <input
        class={[
          "min-w-0 flex-1 border-0 bg-transparent p-0 text-xl leading-tight font-semibold outline-none",
          "placeholder:text-base-content/35",
          done && "text-base-content/50 line-through",
        ]}
        placeholder={$t("panel.event.new")}
        aria-label={$t("panel.title")}
        value={draft.title}
        {@attach node => {
          if (!event) {
            node.focus()
          }
        }}
        oninput={e => (draft.title = e.currentTarget.value)}
        onblur={() => {
          if (finalTitle(draft)) {
            editor.commit()
          }
        }}
        onkeydown={titleKey}
      />
    </div>

    <EventFields {panel} {editor} />

    <RelationField
      {panel}
      {event}
      parent={draft.parent}
      {locked}
      onparent={id => editor.change({ parent: id })}
    />

    <EventNotes {panel} {event} {editor} />
  </div>
</div>

{#if panel.asking}
  <ScopeSheet
    mode={panel.asking.mode}
    scoped={panel.asking.scoped}
    choose={panel.asking.answer}
    cancel={() => panel.asking?.answer(null)}
  />
{/if}
