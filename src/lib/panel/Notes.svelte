<script lang="ts">
  import Icon from "@iconify/svelte"
  import { tick, untrack } from "svelte"
  import { live } from "$lib/data/live.svelte"
  import {
    blankNote,
    notePreview,
    noteTitle,
    searchNotes,
    sortNotes,
  } from "$lib/data/notes"
  import { notes } from "$lib/data/store"
  import type { Note } from "$lib/data/types"

  type Props = {
    openId?: string | null
  }

  let { openId = null }: Props = $props()

  const SAVE_DELAY = 400

  const COLORS: { value: string | null; label: string }[] = [
    { value: null, label: "Default" },
    { value: "var(--color-secondary)", label: "Secondary" },
    { value: "var(--color-accent)", label: "Accent" },
    { value: "var(--color-success)", label: "Success" },
    { value: "var(--color-warning)", label: "Warning" },
    { value: "var(--color-error)", label: "Error" },
  ]

  const noteLive = live(notes)

  let query = $state("")
  let draft = $state<Note | null>(null)
  let conflict = $state(false)
  let titleField = $state<HTMLInputElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Note | null = null

  const visible = $derived(sortNotes(searchNotes(noteLive.items, query)))

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

  const reconcile = async (items: Note[]) => {
    const open = draft

    if (!open || pending?.id === open.id) {
      return
    }

    const stored = items.find(note => note.id === open.id)

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

  const close = async () => {
    await commit()
    draft = null
  }

  const focusTitle = async () => {
    await tick()
    titleField?.focus()
  }

  const create = async () => {
    await commit()

    query = ""
    conflict = false
    draft = await notes.put(blankNote())

    await focusTitle()
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
      close()
    }
  }

  const onWindowKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && !e.repeat && e.key.toLowerCase() === "n") {
      e.preventDefault()
      create()
    }
  }

  $effect(() => {
    const items = noteLive.items

    untrack(() => reconcile(items))
  })

  $effect(() => {
    if (openId) {
      notes.get(openId).then(async note => {
        if (note) {
          await open(note)
          await focusTitle()
        }
      })
    }
  })

  $effect(() => () => {
    commit()
    noteLive.stop()
  })
</script>

<svelte:window onkeydown={onWindowKey} />

<div class="flex min-h-0 grow gap-3">
  <div class="flex w-2/5 min-w-0 flex-col gap-2">
    <div class="flex items-center gap-1">
      <label
        class="input input-xs min-w-0 grow rounded-full border-base-content/10 bg-base-100/60"
      >
        <Icon
          icon="lucide:search"
          class="size-3.5 shrink-0 text-base-content/50"
        />

        <input
          bind:value={query}
          type="text"
          placeholder="Search notes"
          aria-label="Search notes"
          spellcheck="false"
          autocomplete="off"
        />
      </label>

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label="New note"
        title="New note"
        onclick={create}
      >
        <Icon icon="lucide:plus" class="size-4" />
      </button>
    </div>

    <ul class="flex min-h-0 grow flex-col gap-0.5 overflow-y-auto">
      {#each visible as note (note.id)}
        <li>
          <button
            class={[
              "flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150",
              draft?.id === note.id
                ? "bg-base-content/10"
                : "hover:bg-base-content/5",
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

              <span class="min-w-0 grow truncate text-xs font-medium">
                {noteTitle(note)}
              </span>

              {#if note.pinned}
                <Icon
                  icon="lucide:pin"
                  class="size-3 shrink-0 text-primary"
                  aria-label="Pinned"
                />
              {/if}
            </span>

            {#if notePreview(note)}
              <span class="line-clamp-1 w-full text-[11px] text-base-content/50">
                {notePreview(note)}
              </span>
            {/if}
          </button>
        </li>
      {:else}
        <li class="px-2 py-3 text-xs text-base-content/45">
          {query.trim() ? "No matches" : "No notes"}
        </li>
      {/each}
    </ul>
  </div>

  <div
    class="flex min-w-0 grow flex-col gap-2 border-l border-base-content/10 pl-3"
  >
    {#if draft}
      {#if conflict}
        <p class="text-[11px] text-warning">
          Reloaded with a newer version from another device.
        </p>
      {/if}

      <div class="flex items-center gap-1">
        <input
          bind:this={titleField}
          bind:value={draft.title}
          type="text"
          class="input input-sm min-w-0 grow"
          placeholder="Title"
          aria-label="Note title"
          spellcheck="false"
          oninput={edited}
          onkeydown={onEditorKey}
        />

        <button
          class={["btn btn-ghost btn-square btn-sm", draft.pinned && "text-primary"]}
          aria-label={draft.pinned ? "Unpin note" : "Pin note"}
          aria-pressed={draft.pinned}
          onkeydown={onEditorKey}
          onclick={() => patch({ pinned: !draft?.pinned })}
        >
          <Icon icon="lucide:pin" class="size-4" />
        </button>

        <button
          class="btn btn-ghost btn-square btn-sm text-error"
          aria-label="Delete note"
          onkeydown={onEditorKey}
          onclick={remove}
        >
          <Icon icon="lucide:trash-2" class="size-4" />
        </button>
      </div>

      <div class="flex items-center gap-1.5" role="radiogroup" aria-label="Color">
        {#each COLORS as color (color.label)}
          <button
            class={[
              "size-4 rounded-full transition-transform duration-150 hover:scale-110",
              draft.color === color.value &&
                "ring-2 ring-base-content/80 ring-offset-2 ring-offset-base-100",
            ]}
            style:background={color.value ?? "var(--color-primary)"}
            role="radio"
            aria-checked={draft.color === color.value}
            aria-label={color.label}
            onkeydown={onEditorKey}
            onclick={() => patch({ color: color.value })}
          ></button>
        {/each}
      </div>

      <textarea
        bind:value={draft.body}
        class="textarea textarea-sm min-h-0 w-full grow resize-none leading-relaxed"
        placeholder="Write something"
        aria-label="Note body"
        oninput={edited}
        onkeydown={onEditorKey}
      ></textarea>
    {:else}
      <div
        class="flex grow flex-col items-center justify-center gap-2 text-center text-xs text-base-content/50"
      >
        <Icon icon="lucide:notebook-pen" class="size-6 text-base-content/30" />

        {visible.length > 0 ? "Select a note" : "No notes"}

        <button class="btn btn-ghost btn-xs gap-1" onclick={create}>
          New note

          <kbd class="kbd kbd-xs">Ctrl</kbd>

          <kbd class="kbd kbd-xs">N</kbd>
        </button>
      </div>
    {/if}
  </div>
</div>
