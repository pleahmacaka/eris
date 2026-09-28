<script lang="ts">
  import { untrack } from "svelte"
  import { notes } from "$lib/data/store"
  import type { Note } from "$lib/data/types"
  import TopBar from "$lib/components/ui/TopBar.svelte"

  const { note, close }: { note: Note; close: () => void } = $props()

  let title = $state(untrack(() => note.title))
  let body = $state(untrack(() => note.body))
  let pinned = $state(untrack(() => note.pinned))

  const dirty = $derived(
    title !== note.title || body !== note.body || pinned !== note.pinned,
  )

  const persist = async () => {
    if (!dirty) {
      return
    }

    await notes.put({ ...note, title, body, pinned })
  }

  const leave = async () => {
    const empty = title.trim() === "" && body.trim() === ""

    if (empty) {
      await notes.remove(note.id).catch(() => {})
    } else {
      await persist()
    }

    close()
  }

  const drop = async () => {
    await notes.remove(note.id)
    close()
  }

  const stamp = $derived(
    new Date(note.updatedAt).toLocaleString("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  )
</script>

<div class="absolute inset-0 z-30 flex flex-col bg-base-200">
  <TopBar
    title={pinned ? "고정된 메모" : "메모"}
    subtitle={stamp}
    back={leave}
    actions={[
      {
        icon: pinned ? "lucide:pin-off" : "lucide:pin",
        label: "고정",
        run: () => {
          pinned = !pinned
          persist()
        },
      },
      { icon: "lucide:trash-2", label: "삭제", run: drop },
    ]}
  />

  <div class="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
    <input
      class={[
        "w-full bg-transparent text-2xl font-bold tracking-tight",
        "outline-none",
      ]}
      placeholder="제목"
      bind:value={title}
      onblur={persist}
    />

    <textarea
      class={[
        "min-h-0 w-full flex-1 resize-none bg-transparent",
        "text-base leading-relaxed outline-none",
      ]}
      placeholder="내용을 입력하세요."
      bind:value={body}
      onblur={persist}
    ></textarea>
  </div>
</div>
