<script lang="ts">
  import Section from "$lib/components/ui/Section.svelte"
  import { patchSync } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import { resetFromPeers } from "$lib/sync/engine"
  import type { SyncedCollection } from "$lib/sync/protocol"
  import { syncedCollections } from "$lib/sync/protocol"

  let resetting = $state(false)

  const settings = $derived(device.value.sync)

  const LABELS: Record<SyncedCollection, string> = {
    notes: "메모",
    todos: "할 일",
    events: "일정",
  }

  const INTERVALS = [1, 5, 15, 30, 60]

  const toggle = (name: SyncedCollection) =>
    patchSync({
      collections: {
        ...settings.collections,
        [name]: !settings.collections[name],
      },
    })

  const reset = async () => {
    resetting = true

    try {
      await resetFromPeers()
    } finally {
      resetting = false
    }
  }
</script>

<Section title="동기화 항목">
  <div class="flex flex-wrap gap-2">
    {#each syncedCollections as name (name)}
      <button
        class={[
          "btn btn-sm",
          settings.collections[name] ? "btn-primary" : "btn-outline",
        ]}
        onclick={() => toggle(name)}
      >
        {LABELS[name]}
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-3">
    <span class="w-24 shrink-0 text-sm">주기</span>
    <select
      class="select select-sm flex-1"
      value={settings.intervalMinutes}
      onchange={e =>
        patchSync({ intervalMinutes: Number(e.currentTarget.value) })}
    >
      {#each INTERVALS as minutes (minutes)}
        <option value={minutes}>{minutes}분</option>
      {/each}
    </select>
  </div>

  <button class="btn btn-sm" disabled={resetting} onclick={reset}>
    {#if resetting}
      <span class="loading loading-spinner loading-xs"></span>
    {/if}
    노드에서 전부 다시 받기
  </button>
</Section>
