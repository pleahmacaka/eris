<script lang="ts">
  import Icon from "@iconify/svelte"
  import PeerEditor from "$lib/components/settings/PeerEditor.svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import { upsertPeer } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import type { Peer } from "$lib/sync/protocol"
  import { sync } from "$lib/sync/status.svelte"

  let editor = $state<Partial<Peer> | null>(null)

  const peers = $derived(device.value.sync.peers)

  const statusOf = (peer: Peer) => sync.peers.find(p => p.id === peer.id)

  const detail = (peer: Peer) => {
    const status = statusOf(peer)

    if (status?.state === "online") {
      return `연결됨 · ${status.latencyMs}ms · seq ${status.seq}`
    }

    return status?.lastError ?? peer.url
  }
</script>

<Section title="노드" hint="켜져 있는 노드를 모두 찾아 서로 주고받습니다.">
  <ul class="flex flex-col gap-2">
    {#each peers as peer (peer.id)}
      {@const status = statusOf(peer)}
      <li class="flex items-center gap-3 rounded-box bg-base-200 px-3 py-2.5">
        <span
          class={[
            "size-2 shrink-0 rounded-full",
            status?.state === "online"
              ? "bg-success"
              : status?.state === "offline"
                ? "bg-error"
                : "bg-base-content/25",
          ]}
        ></span>

        <button
          class="min-w-0 flex-1 cursor-pointer text-left"
          onclick={() => (editor = peer)}
        >
          <p class="truncate text-sm font-medium">
            {peer.label || peer.url}
            <span class="ml-1 text-xs font-normal text-base-content/40">
              {peer.role === "hub" ? "중앙 서버" : "P2P"}
            </span>
          </p>
          <p class="truncate text-xs text-base-content/45">{detail(peer)}</p>
        </button>

        <input
          type="checkbox"
          class="toggle toggle-xs toggle-primary"
          checked={peer.enabled}
          onchange={e =>
            upsertPeer({ ...peer, enabled: e.currentTarget.checked })}
        />
      </li>
    {/each}
  </ul>

  <button
    class="btn btn-outline btn-sm"
    onclick={() => (editor = { role: "node" })}
  >
    <Icon icon="lucide:plus" class="size-4" />
    P2P 노드 추가
  </button>
</Section>

{#if editor}
  {#key editor.id ?? "new"}
    <PeerEditor peer={editor} close={() => (editor = null)} />
  {/key}
{/if}
