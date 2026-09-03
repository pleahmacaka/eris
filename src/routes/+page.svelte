<script lang="ts">
  import NoteEditor from "$lib/components/note/NoteEditor.svelte"
  import NoteList from "$lib/components/note/NoteList.svelte"
  import TopBar from "$lib/components/ui/TopBar.svelte"
  import type { Note } from "$lib/data/types"

  let editing = $state<Note | null>(null)
</script>

<TopBar title="메모" />

<main class="relative mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col pt-2">
  <NoteList open={note => (editing = note)} />

  {#if editing}
    {#key editing.id}
      <NoteEditor note={editing} close={() => (editing = null)} />
    {/key}
  {/if}
</main>
