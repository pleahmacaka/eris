<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import {
    onP2pPeers,
    type P2pStatus,
    p2pInvite,
    p2pJoin,
    p2pLeave,
    p2pStatus,
    p2pSupported,
  } from "$lib/platform/p2p"
  import { patchDevice, patchSync } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import { syncNow } from "$lib/sync/engine"
  import { type SyncedCollection, syncedCollections } from "$lib/sync/protocol"
  import { refreshPairing, type SyncState, sync } from "$lib/sync/status.svelte"

  const STATES: Record<SyncState, { label: string; tone: string }> = {
    unsupported: { label: "미지원", tone: "badge-ghost" },
    unpaired: { label: "미연결", tone: "badge-ghost" },
    syncing: { label: "동기화 중", tone: "badge-info" },
    idle: { label: "연결됨", tone: "badge-success" },
    error: { label: "동기화 오류", tone: "badge-error" },
  }

  const LABELS: Record<SyncedCollection, string> = {
    notes: "메모",
    todos: "할 일",
    events: "일정",
  }

  const INTERVALS = [1, 5, 15, 30, 60]

  let pairing = $state<P2pStatus | null>(null)
  let code = $state("")
  let joinCode = $state("")
  let busy = $state(false)
  let failure = $state("")
  let copied = $state(false)
  let confirming = $state(false)

  const paired = $derived(pairing?.paired ?? false)

  const peers = $derived(pairing?.peers ?? [])

  const badge = $derived(
    sync.state === "idle" && peers.length === 0
      ? { label: "연결 대기", tone: "badge-warning" }
      : STATES[sync.state],
  )

  const settings = $derived(device.value.sync)

  const toggle = (name: SyncedCollection) =>
    patchSync({
      collections: {
        ...settings.collections,
        [name]: !settings.collections[name],
      },
    })

  const stamp = (at: number) =>
    new Date(at).toLocaleString("ko-KR", {
      dateStyle: "short",
      timeStyle: "short",
    })

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const refresh = async () => {
    const before = peers.length

    pairing = await p2pStatus().catch(() => null)

    if (peers.length > before) {
      code = ""
    }
  }

  $effect(() => {
    if (!p2pSupported()) {
      return
    }

    untrack(refresh)

    const stop = onP2pPeers(refresh)

    return () => {
      stop.then(fn => fn())
    }
  })

  const act = async (task: () => Promise<void>) => {
    busy = true
    failure = ""

    try {
      await task()
      await refresh()
      await refreshPairing()
    } catch (error) {
      failure = message(error)
    } finally {
      busy = false
    }
  }

  const invite = () =>
    act(async () => {
      copied = false
      code = await p2pInvite(device.value.deviceName)
      await syncNow()
    })

  const join = () =>
    act(async () => {
      await p2pJoin(joinCode.trim(), device.value.deviceName)
      joinCode = ""
      code = ""
      await syncNow()
    })

  const leave = () =>
    act(async () => {
      await p2pLeave()
      code = ""
      confirming = false
    })

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      copied = true
    } catch (error) {
      failure = message(error)
    }
  }
</script>

<Section title="기기 동기화">
  <div class="flex flex-col gap-3 border border-base-content/10 bg-base-100 p-4">
    <div class="flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="truncate text-sm font-medium">
            {device.value.deviceName || "이 기기"}
          </span>
          <span class={["badge badge-sm shrink-0", badge.tone]}>
            {badge.label}
          </span>
        </div>

        <p class="truncate text-xs text-base-content/50">
          {sync.lastSyncAt
            ? `마지막 동기화 ${stamp(sync.lastSyncAt)}`
            : "동기화 기록 없음"}
        </p>
      </div>

      <button
        class="btn btn-ghost btn-square btn-sm"
        aria-label="지금 동기화"
        disabled={!paired || sync.state === "syncing"}
        onclick={syncNow}
      >
        <Icon
          icon="lucide:refresh-cw"
          class={["size-4", sync.state === "syncing" && "animate-spin"]}
        />
      </button>
    </div>

    {#if sync.state === "unsupported"}
      <p class="text-xs text-base-content/50">
        Windows 또는 Android 앱에서 동기화하세요.
      </p>
    {:else}
      <label class="floating-label">
        <span>기기 이름</span>
        <input
          class="input input-sm w-full"
          value={device.value.deviceName}
          onchange={e =>
            patchDevice({ deviceName: e.currentTarget.value.trim() })}
        />
      </label>
    {/if}

    {#if sync.state === "error" && sync.lastError}
      <p class="whitespace-pre-wrap break-all text-xs text-error">
        {sync.lastError}
      </p>
    {/if}
  </div>
</Section>

{#if sync.state !== "unsupported"}
  <Section title="연결된 기기">
    {#if peers.length === 0}
      <div
        class={[
          "border border-dashed border-base-content/15 px-4 py-6",
          "text-center text-sm text-base-content/50",
        ]}
      >
        연결된 기기 없음
      </div>
    {:else}
      <ul class="flex flex-col border border-base-content/10 bg-base-100">
        {#each peers as peer (peer.nodeId)}
          <li
            class={[
              "flex items-center gap-3 border-b border-base-content/10",
              "px-4 py-3 last:border-b-0",
            ]}
          >
            <Icon
              icon="lucide:monitor-smartphone"
              class="size-4 shrink-0 text-base-content/50"
            />

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">
                {peer.name || peer.nodeId.slice(0, 8)}
              </p>
              <p class="text-xs text-base-content/50">
                {peer.lastSeen === null
                  ? "연결 기록 없음"
                  : `최근 연결 ${stamp(peer.lastSeen)}`}
              </p>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <div class="flex flex-col gap-3">
      <button class="btn btn-sm" disabled={busy} onclick={invite}>
        <Icon icon="lucide:link" class="size-4" />
        연결 코드 생성
      </button>

      {#if code}
        <div class="flex flex-col gap-2">
          <div class="join w-full">
            <input
              class="input input-sm join-item w-full"
              readonly
              aria-label="연결 코드"
              value={code}
            />
            <button
              class="btn btn-sm join-item"
              aria-label="복사"
              onclick={copy}
            >
              <Icon
                icon={copied ? "lucide:check" : "lucide:copy"}
                class="size-4"
              />
            </button>
          </div>
          <p class="text-xs text-base-content/50">
            다른 기기에서 이 코드를 입력하세요.
          </p>
        </div>
      {/if}

      {#if !paired}
        <div class="join w-full">
          <input
            class="input input-sm join-item w-full"
            placeholder="연결 코드"
            aria-label="연결 코드"
            autocomplete="off"
            spellcheck="false"
            bind:value={joinCode}
          />
          <button
            class="btn btn-primary btn-sm join-item"
            disabled={busy || joinCode.trim() === ""}
            onclick={join}
          >
            연결
          </button>
        </div>
      {:else if confirming}
        <div class="flex flex-col gap-2 border border-error/30 p-3">
          <p class="text-sm">이 기기의 데이터는 그대로 유지됩니다.</p>

          <div class="flex gap-2">
            <button
              class="btn btn-ghost btn-sm flex-1"
              onclick={() => (confirming = false)}
            >
              취소
            </button>
            <button
              class="btn btn-error btn-sm flex-1"
              disabled={busy}
              onclick={leave}
            >
              연결 해제
            </button>
          </div>
        </div>
      {:else}
        <button
          class="btn btn-ghost btn-sm self-start text-error"
          onclick={() => (confirming = true)}
        >
          연결 해제
        </button>
      {/if}

      {#if failure}
        <p class="whitespace-pre-wrap break-all text-xs text-error">
          {failure}
        </p>
      {/if}
    </div>
  </Section>

  <Section title="동기화 항목">
    <div class="flex flex-wrap gap-2">
      {#each syncedCollections as name (name)}
        <button
          class={[
            "btn btn-sm",
            settings.collections[name] ? "btn-primary" : "btn-outline",
          ]}
          aria-pressed={settings.collections[name]}
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
  </Section>
{/if}
