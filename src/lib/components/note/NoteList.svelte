<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live } from "$lib/data/live.svelte"
  import { blankNote, notePreview, noteTitle, searchNotes } from "$lib/data/notes"
  import { notes } from "$lib/data/store"
  import type { Note } from "$lib/data/types"

  const { open }: { open: (note: Note) => void } = $props()

  const store = live(notes)

  let query = $state("")

  const visible = $derived(searchNotes(store.items, query))

  const pinned = $derived(visible.filter(n => n.pinned))

  const rest = $derived(visible.filter(n => !n.pinned))

  const stamp = (note: Note) =>
    new Date(note.updatedAt).toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    })

  const create = () => open(blankNote())
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="shrink-0 px-3 pb-2">
    <label class="input input-sm w-full rounded-field bg-base-200">
      <Icon icon="lucide:search" class="size-4 opacity-50" />
      <input
        type="search"
        placeholder="메모 검색"
        bind:value={query}
        class="grow"
      />
    </label>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-24">
    {#if store.ready && visible.length === 0}
      <div class="flex flex-col items-center gap-3 py-20 text-center">
        <Icon icon="lucide:notebook-pen" class="size-10 opacity-25" />
        <p class="text-sm text-base-content/55">
          {query ? "검색 결과 없음" : "메모 없음"}
        </p>
      </div>
    {/if}

    {#each [{ label: "고정", items: pinned }, { label: "", items: rest }] as group (group.label)}
      {#if group.items.length > 0}
        {#if group.label}
          <p
            class="px-1 pb-1 pt-2 text-xs font-medium text-base-content/45"
          >
            {group.label}
          </p>
        {/if}

        <ul class="flex flex-col gap-2 pb-2">
          {#each group.items as note (note.id)}
            <li>
              <button
                class={[
                  "w-full cursor-pointer rounded-box bg-base-200 p-3 text-left",
                  "transition-colors active:bg-base-300",
                ]}
                onclick={() => open(note)}
              >
                <div class="flex items-start gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{noteTitle(note)}</p>
                    <p class="truncate text-sm text-base-content/55">
                      {notePreview(note) || "내용 없음"}
                    </p>
                  </div>

                  <span class="tabular shrink-0 text-xs text-base-content/40">
                    {stamp(note)}
                  </span>
                </div>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
  </div>

  <button
    class={[
      "btn btn-primary btn-circle absolute right-5 z-10 size-14 shadow-lg",
      "bottom-24 lg:bottom-8",
    ]}
    aria-label="메모 추가"
    onclick={create}
  >
    <Icon icon="lucide:plus" class="size-6" />
  </button>
</div>
