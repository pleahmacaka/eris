<script lang="ts">
  import Icon from "@iconify/svelte"
  import { removePeer, upsertPeer } from "$lib/settings"
  import { probe } from "$lib/sync/engine"
  import { normalizeUrl, type Peer, type PeerRole } from "$lib/sync/protocol"

  const {
    peer,
    close,
  }: { peer: Partial<Peer>; close: () => void } = $props()

  const existing = Boolean(peer.id)

  let label = $state(peer.label ?? "")
  let url = $state(peer.url ?? "")
  let token = $state(peer.token ?? "")
  let role = $state<PeerRole>(peer.role ?? "node")
  let testing = $state(false)
  let result = $state<{ ok: boolean; text: string } | null>(null)

  const ROLES: { id: PeerRole; label: string; hint: string }[] = [
    { id: "hub", label: "중앙 서버", hint: "항상 켜져 있는 허브" },
    { id: "node", label: "P2P 노드", hint: "다른 기기가 여는 노드" },
  ]

  const test = async () => {
    testing = true
    result = null

    try {
      const health = await probe({ url, token })

      result = {
        ok: true,
        text: `연결됨 · v${health.version} · seq ${health.seq} · ${health.latencyMs}ms`,
      }
    } catch (error) {
      result = {
        ok: false,
        text: error instanceof Error ? error.message : String(error),
      }
    } finally {
      testing = false
    }
  }

  const save = async () => {
    await upsertPeer({
      ...peer,
      label: label.trim(),
      url: normalizeUrl(url),
      token: token.trim(),
      role,
      enabled: peer.enabled ?? true,
    })

    close()
  }

  const drop = async () => {
    if (peer.id) {
      await removePeer(peer.id)
    }

    close()
  }
</script>

<div class="modal modal-open modal-bottom sm:modal-middle">
  <div class="modal-box flex flex-col gap-3">
    <h3 class="text-lg font-semibold">
      {existing ? "노드 편집" : "노드 추가"}
    </h3>

    <div class="join w-full">
      {#each ROLES as option (option.id)}
        <button
          class={[
            "btn join-item flex-1",
            role === option.id && "btn-primary",
          ]}
          onclick={() => (role = option.id)}
        >
          {option.label}
        </button>
      {/each}
    </div>

    <p class="text-xs text-base-content/50">
      {ROLES.find(r => r.id === role)?.hint}
    </p>

    <label class="floating-label">
      <span>이름</span>
      <input
        class="input w-full"
        placeholder="집 서버"
        bind:value={label}
      />
    </label>

    <label class="floating-label">
      <span>주소</span>
      <input
        class="input w-full"
        placeholder="http://pmc-desktop.daeeun.vpn:47821"
        inputmode="url"
        autocapitalize="none"
        autocorrect="off"
        bind:value={url}
      />
    </label>

    <label class="floating-label">
      <span>토큰</span>
      <input
        class="input w-full"
        type="password"
        autocapitalize="none"
        autocorrect="off"
        bind:value={token}
      />
    </label>

    <button
      class="btn btn-outline btn-sm"
      disabled={testing || url.trim() === ""}
      onclick={test}
    >
      {#if testing}
        <span class="loading loading-spinner loading-xs"></span>
      {:else}
        <Icon icon="lucide:plug-zap" class="size-4" />
      {/if}
      연결 테스트
    </button>

    {#if result}
      <p
        class={[
          "break-all text-xs",
          result.ok ? "text-success" : "text-error",
        ]}
      >
        {result.text}
      </p>
    {/if}

    <div class="modal-action mt-1">
      {#if existing}
        <button class="btn btn-ghost btn-sm text-error" onclick={drop}>
          삭제
        </button>
      {/if}

      <button class="btn btn-ghost btn-sm" onclick={close}>취소</button>

      <button
        class="btn btn-primary btn-sm"
        disabled={url.trim() === ""}
        onclick={save}
      >
        저장
      </button>
    </div>
  </div>

  <button class="modal-backdrop" aria-label="닫기" onclick={close}></button>
</div>
