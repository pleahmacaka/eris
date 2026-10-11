<script lang="ts">
  import { t } from "svelte-i18n"
  import { type Occurrence, setNotesSync } from "$lib/data"
  import type { EditingState } from "./editing.svelte"
  import MemoEditor from "./MemoEditor.svelte"
  import NoteText from "./NoteText.svelte"
  import type { Panel } from "./panel.svelte"

  const { panel, event, editor }: {
    panel: Panel
    event: Occurrence | null
    editor: EditingState
  } = $props()
  const draft = $derived(editor.draft)
  const referencing = $derived(panel.device.note.enabled && panel.device.note.references)
</script>

<div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
  <span class="text-2xs font-medium text-base-content/60">
    {$t("panel.event.notes")}
  </span>

  {#if event?.seriesDate}
    {@const occurrence = event}
    <label class="flex cursor-pointer items-center gap-1.5 text-2xs text-base-content/45">
      {$t(occurrence.notesSync ? "panel.event.notesSync.all" : "panel.event.notesSync.ask")}
      <span class="ml-auto text-base-content/60">{$t("panel.event.notesSync.label")}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-xs"
        checked={occurrence.notesSync ?? false}
        onchange={e => setNotesSync(occurrence, e.currentTarget.checked)}
      />
    </label>
  {/if}

  {#if editor.writingNotes}
    <MemoEditor
      text={draft.notes}
      references={referencing}
      onchange={notes => (draft.notes = notes)}
      onblur={() => {
        editor.writingNotes = false
        editor.commit()
      }}
    />
  {:else}
    <div
      role="button"
      tabindex="0"
      class="-mx-2 cursor-text rounded-field px-2 py-1 text-left transition-colors duration-120 hover:bg-base-content/6"
      onclick={e => {
        if (!(e.target as Element).closest("button, a")) {
          editor.writingNotes = true
        }
      }}
      onkeydown={e => {
        if (e.key === "Enter" && e.target === e.currentTarget) {
          editor.writingNotes = true
        }
      }}
    >
      {#if draft.notes}
        <NoteText text={draft.notes} link={panel.device.note} />
      {:else}
        <span class="text-sm text-base-content/45">{$t("panel.event.writeNotes")}</span>
      {/if}
    </div>
  {/if}
</div>
