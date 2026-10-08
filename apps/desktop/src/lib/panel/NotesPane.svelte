<script lang="ts">
  import Icon from "@iconify/svelte"
  import { tick, untrack } from "svelte"
  import { t } from "svelte-i18n"
  import {
    blankNote,
    type Note,
    notePreview,
    notes,
    noteTitle,
    searchNotes,
    sortNotes,
  } from "$lib/data"

  const { items, back }: { items: Note[]; back: () => void } = $props()

  const SAVE_DELAY = 400

  const COLORS: { value: string | null; id: string }[] = [
    { value: null, id: "default" },
    { value: "var(--color-secondary)", id: "secondary" },
    { value: "var(--color-accent)", id: "accent" },
    { value: "var(--color-success)", id: "success" },
    { value: "var(--color-warning)", id: "warning" },
    { value: "var(--color-error)", id: "error" },
  ]

  let query = $state("")
  let draft = $state<Note | null>(null)
  let conflict = $state(false)
  let titleField = $state<HTMLInputElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Note | null = null

  const visible = $derived(sortNotes(searchNotes(items, query)))

  const commit = async () => {
    clearTimeout(timer)
    timer = undefined

    const item = pending

    pending = null

    if (!item) {
      return
    }

    const stored = await notes.get(item.id)
    const base = draft?.id === item.id ? draft.updatedAt : item.updatedAt

    if (!stored) {
      if (draft?.id === item.id) {
        draft = null
      }

      return
    }

    if (stored.updatedAt > base) {
      if (draft?.id === item.id) {
        draft = { ...stored }
        conflict = true
      }

      return
    }

    const saved = await notes.put(item)

    if (draft?.id === saved.id) {
      draft.updatedAt = saved.updatedAt
    }
  }

  const edited = () => {
    pending = $state.snapshot(draft)
    clearTimeout(timer)
    timer = setTimeout(commit, SAVE_DELAY)
  }

  const reconcile = async (list: Note[]) => {
    const open = draft

    if (!open || pending?.id === open.id) {
      return
    }

    const stored = list.find(note => note.id === open.id)

    if (stored) {
      if (stored.updatedAt !== open.updatedAt) {
        conflict = false
        draft = { ...stored }
      }

      return
    }

    if (!(await notes.get(open.id)) && draft?.id === open.id) {
      draft = null
    }
  }

  const open = async (note: Note) => {
    await commit()
    conflict = false
    draft = { ...note }
  }

  const closeNote = async () => {
    await commit()
    draft = null
  }

  const create = async () => {
    await commit()

    query = ""
    conflict = false
    draft = await notes.put(blankNote())

    await tick()
    titleField?.focus()
  }

  const remove = async () => {
    if (!draft) {
      return
    }

    if (pending?.id === draft.id) {
      pending = null
    }

    await notes.remove(draft.id)
    draft = null
  }

  const patch = async (change: Partial<Note>) => {
    if (!draft) {
      return
    }

    draft = { ...draft, ...change }
    pending = $state.snapshot(draft)

    await commit()
  }

  const onEditorKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && draft) {
      e.stopPropagation()
      closeNote()
    }
  }

  $effect(() => {
    const list = items

    untrack(() => reconcile(list))
  })

  $effect(() => () => {
    commit()
  })
</script>

<div class="flex h-full min-h-0 flex-col select-text">
  <header
    class="flex min-h-14 items-center gap-2 border-b border-base-300 px-3 py-3"
  >
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs"
      aria-label={$t("common.back")}
      onclick={() => (draft ? closeNote() : back())}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <h2 class="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
      {$t("panel.notesAria")}
    </h2>

    {#if draft}
      <button
        type="button"
        class={["btn btn-ghost btn-square btn-xs", draft.pinned && "text-primary"]}
        aria-label={draft.pinned
          ? $t("panel.notes.unpin")
          : $t("panel.notes.pin")}
        aria-pressed={draft.pinned}
        onclick={() => patch({ pinned: !draft?.pinned })}
      >
        <Icon icon="lucide:pin" class="size-3.5" />
      </button>

      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs text-error"
        aria-label={$t("panel.notes.delete")}
        onclick={remove}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    {:else}
      <button
        type="button"
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("panel.notes.new")}
        onclick={create}
      >
        <Icon icon="lucide:plus" class="size-3.5" />
      </button>
    {/if}
  </header>

  {#if draft}
    <div class="flex min-h-0 flex-1 flex-col gap-3 p-3">
      {#if conflict}
        <p class="text-2xs text-warning">{$t("panel.notes.conflict")}</p>
      {/if}

      <input
        bind:this={titleField}
        bind:value={draft.title}
        type="text"
        class="input input-sm w-full"
        placeholder={$t("panel.title")}
        aria-label={$t("panel.notes.titleAria")}
        spellcheck="false"
        oninput={edited}
        onkeydown={onEditorKey}
      />

      <div
        class="flex items-center gap-2 px-0.5"
        role="radiogroup"
        aria-label={$t("panel.event.color")}
      >
        {#each COLORS as color (color.id)}
          <button
            type="button"
            class={[
              "size-4 cursor-pointer rounded-full transition-transform duration-120",
              "hover:scale-110",
              draft.color === color.value &&
                "ring-2 ring-base-content/80 ring-offset-2 ring-offset-base-100",
            ]}
            style:background={color.value ?? "var(--color-primary)"}
            role="radio"
            aria-checked={draft.color === color.value}
            aria-label={$t(`panel.colors.${color.id}`)}
            onkeydown={onEditorKey}
            onclick={() => patch({ color: color.value })}
          ></button>
        {/each}
      </div>

      <textarea
        bind:value={draft.body}
        class="textarea min-h-0 w-full flex-1 resize-none text-sm leading-relaxed"
        placeholder={$t("panel.notes.bodyPlaceholder")}
        aria-label={$t("panel.notes.bodyAria")}
        oninput={edited}
        onkeydown={onEditorKey}
      ></textarea>
    </div>
  {:else}
    <div class="border-b border-base-300 p-2">
      <label class="input input-sm w-full">
        <Icon icon="lucide:search" class="size-3.5 shrink-0 text-base-content/50" />
        <input
          bind:value={query}
          type="text"
          placeholder={$t("panel.notes.search")}
          aria-label={$t("panel.notes.search")}
          spellcheck="false"
          autocomplete="off"
        />
      </label>
    </div>

    <ul class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {#each visible as note (note.id)}
        <li>
          <button
            type="button"
            class={[
              "flex w-full cursor-pointer flex-col gap-0.5 rounded-field px-2.5 py-2",
              "text-left transition-colors duration-120 hover:bg-base-content/5",
            ]}
            onclick={() => open(note)}
          >
            <span class="flex w-full items-center gap-1.5">
              {#if note.color}
                <span
                  class="size-2 shrink-0 rounded-full"
                  style:background={note.color}
                ></span>
              {/if}

              <span class="min-w-0 flex-1 truncate text-sm font-medium">
                {noteTitle(note)}
              </span>

              {#if note.pinned}
                <Icon
                  icon="lucide:pin"
                  class="size-3 shrink-0 text-primary"
                  aria-label={$t("panel.notes.pinned")}
                />
              {/if}
            </span>

            {#if notePreview(note)}
              <span class="line-clamp-2 text-xs text-base-content/55">
                {notePreview(note)}
              </span>
            {/if}
          </button>
        </li>
      {:else}
        <li
          class={[
            "flex h-full flex-col items-center justify-center gap-2 py-10",
            "text-xs text-base-content/50",
          ]}
        >
          <Icon icon="lucide:notebook-pen" class="size-6 opacity-60" />
          {query.trim() ? $t("common.noMatches") : $t("panel.notes.noNotes")}
        </li>
      {/each}
    </ul>
  {/if}
</div>
