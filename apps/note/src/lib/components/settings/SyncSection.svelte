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
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"

  const STATES: Record<SyncState, { label: string; dot: string; text: string }> =
    {
      unsupported: {
        label: "미지원",
        dot: "bg-base-content/30",
        text: "text-base-content/60",
      },
      unpaired: {
        label: "연결 안 됨",
        dot: "bg-base-content/30",
        text: "text-base-content/60",
      },
      syncing: {
        label: "동기화 중",
        dot: "bg-info animate-pulse",
        text: "text-info",
      },
      idle: { label: "연결됨", dot: "bg-success", text: "text-success" },
      error: { label: "동기화 오류", dot: "bg-error", text: "text-error" },
    }

  const COLLECTIONS: Record<
    SyncedCollection,
    { label: string; hint: string; icon: string }
  > = {
    files: {
      label: "노트",
      hint: "볼트의 Markdown과 캔버스 파일",
      icon: "lucide:file-text",
    },
    todos: {
      label: "할 일",
      hint: "할 일 보드의 모든 항목",
      icon: "lucide:list-checks",
    },
    events: {
      label: "일정",
      hint: "캘린더 일정, 같은 체인의 Eris와도 공유됩니다",
      icon: "lucide:calendar-days",
    },
  }

  const INTERVALS = [1, 5, 15, 30, 60].map(minutes => ({
    id: minutes,
    label: `${minutes}분`,
  }))

  const relative = new Intl.RelativeTimeFormat("ko", { numeric: "auto" })

  let pairing = $state<P2pStatus | null>(null)
  let code = $state("")
  let joinCode = $state("")
  let busy = $state(false)
  let failure = $state("")
  let copied = $state(false)
  let confirming = $state(false)

  const paired = $derived(pairing?.paired ?? false)

  const peers = $derived(pairing?.peers ?? [])

  const status = $derived(
    sync.state === "idle" && peers.length === 0
      ? {
          label: "연결 대기",
          dot: "bg-warning animate-pulse",
          text: "text-warning",
        }
      : STATES[sync.state],
  )

  const settings = $derived(device.value.sync)

  const chunks = $derived(code.match(/.{1,4}/g) ?? [])

  const toggle = (name: SyncedCollection) =>
    patchSync({
      collections: {
        ...settings.collections,
        [name]: !settings.collections[name],
      },
    })

  const ago = (at: number) => {
    const minutes = Math.round((at - Date.now()) / 60_000)

    if (minutes === 0) {
      return "방금 전"
    }

    if (Math.abs(minutes) < 60) {
      return relative.format(minutes, "minute")
    }

    const hours = Math.round(minutes / 60)

    return Math.abs(hours) < 24
      ? relative.format(hours, "hour")
      : relative.format(Math.round(hours / 24), "day")
  }

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

<Section title="이 기기">
  <div class="flex flex-col border border-base-content/10 bg-base-content/[0.02]">
    <div class="flex items-center gap-4 p-4">
      <span
        class={[
          "relative flex size-11 shrink-0 items-center justify-center border",
          "border-base-content/15",
        ]}
      >
        <Icon icon="lucide:monitor-smartphone" class="size-5 opacity-70" />
        <span
          class={["absolute -right-1 -top-1 size-2.5", status.dot]}
          aria-hidden="true"
        ></span>
      </span>

      <div class="min-w-0 flex-1">
        <p class={["text-xs font-medium", status.text]}>{status.label}</p>
        <p class="tabular truncate text-xs text-base-content/50">
          {sync.lastSyncAt
            ? `마지막 동기화 ${ago(sync.lastSyncAt)}`
            : "동기화 기록 없음"}
          {#if paired}
            · 기기 {peers.length}대
          {/if}
        </p>
      </div>

      <button
        class="btn btn-sm"
        disabled={!paired || sync.state === "syncing"}
        onclick={syncNow}
      >
        <Icon
          icon="lucide:refresh-cw"
          class={["size-4", sync.state === "syncing" && "animate-spin"]}
        />
        <span class="@max-lg:hidden">지금 동기화</span>
      </button>
    </div>

    {#if sync.state === "unsupported"}
      <p class="border-t border-base-content/10 px-4 py-3 text-xs text-base-content/50">
        Windows 또는 Android 앱에서 동기화하세요.
      </p>
    {:else}
      <label
        class="flex items-center gap-3 border-t border-base-content/10 px-4 py-3"
      >
        <span class="w-16 shrink-0 text-xs text-base-content/50">기기 이름</span>
        <input
          class="input input-sm input-ghost flex-1 px-2"
          value={device.value.deviceName}
          placeholder="다른 기기에 보일 이름"
          onchange={e =>
            patchDevice({ deviceName: e.currentTarget.value.trim() })}
        />
      </label>
    {/if}

    {#if sync.state === "error" && sync.lastError}
      <p
        class={[
          "whitespace-pre-wrap break-all border-t border-error/20",
          "bg-error/5 px-4 py-3 text-xs text-error",
        ]}
      >
        {sync.lastError}
      </p>
    {/if}
  </div>
</Section>

{#if sync.state !== "unsupported"}
  <Section title="연결된 기기">
    {#snippet aside()}
      <span class="tabular text-xs text-base-content/40">
        {String(peers.length).padStart(2, "0")}
      </span>
    {/snippet}

    {#if peers.length === 0}
      <div
        class={[
          "flex flex-col items-center gap-1 border border-dashed",
          "border-base-content/15 px-4 py-7 text-center",
        ]}
      >
        <pre
          class="text-xs leading-tight text-primary/60"
          aria-hidden="true">[ ]──?──[ ]</pre>
        <p class="mt-2 text-sm text-base-content/60">연결된 기기 없음</p>
        <p class="text-xs text-base-content/40">
          아래에서 연결 코드를 만들거나 입력하세요.
        </p>
      </div>
    {:else}
      <ul class="flex flex-col divide-y divide-base-content/10 border border-base-content/10">
        {#each peers as peer (peer.nodeId)}
          <li class="flex items-center gap-3 px-4 py-3">
            <Icon
              icon="lucide:monitor-smartphone"
              class="size-4 shrink-0 text-base-content/50"
            />

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm">
                {peer.name || peer.nodeId.slice(0, 8)}
              </p>
              <p class="verbatim truncate text-2xs text-base-content/40">
                {peer.nodeId.slice(0, 16)}
              </p>
            </div>

            <span class="tabular shrink-0 text-xs text-base-content/50">
              {peer.lastSeen === null ? "연결 기록 없음" : ago(peer.lastSeen)}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </Section>

  <Section title="기기 연결">
    <div class="grid gap-3 @lg:grid-cols-2">
      <div class="flex flex-col gap-3 border border-base-content/10 p-4">
        <p class="flex items-center gap-2 text-sm font-medium">
          <span class="tabular text-xs text-primary">01</span>
          코드 만들기
        </p>
        <p class="text-xs leading-relaxed text-base-content/50">
          코드를 만들어 연결할 기기에 입력하세요. 코드는 이 체인에 들어오는
          열쇠라서 믿는 기기에만 알려 주세요.
        </p>

        {#if code}
          <div class="flex flex-col gap-2">
            <p
              class={[
                "verbatim break-all border border-primary/30 bg-primary/5 p-3",
                "text-xs leading-relaxed select-all",
              ]}
              aria-label="연결 코드"
            >
              <!-- inline spans with no text between them, so a copied selection is the exact code -->
              {#each chunks as chunk, i (i)}<span
                  class={["mr-1.5", i % 2 === 1 && "text-base-content/55"]}
                  >{chunk}</span
                >{/each}
            </p>
            <button class="btn btn-sm" onclick={copy}>
              <Icon icon={copied ? "lucide:check" : "lucide:copy"} class="size-4" />
              {copied ? "복사됨" : "코드 복사"}
            </button>
          </div>
        {:else}
          <button class="btn btn-sm mt-auto" disabled={busy} onclick={invite}>
            <Icon icon="lucide:key-round" class="size-4" />
            연결 코드 생성
          </button>
        {/if}
      </div>

      {#if !paired}
        <div class="flex flex-col gap-3 border border-base-content/10 p-4">
          <p class="flex items-center gap-2 text-sm font-medium">
            <span class="tabular text-xs text-primary">02</span>
            코드 입력
          </p>
          <p class="text-xs leading-relaxed text-base-content/50">
            다른 기기에서 만든 코드를 붙여 넣으면 그 기기의 체인에 합류합니다.
          </p>
          <input
            class="verbatim input input-sm mt-auto w-full"
            placeholder="연결 코드"
            aria-label="연결 코드 입력"
            autocomplete="off"
            spellcheck="false"
            bind:value={joinCode}
          />
          <button
            class="btn btn-primary btn-sm"
            disabled={busy || joinCode.trim() === ""}
            onclick={join}
          >
            <Icon icon="lucide:link" class="size-4" />
            연결
          </button>
        </div>
      {:else}
        <div
          class={[
            "flex flex-col gap-3 border p-4",
            confirming ? "border-error/40 bg-error/5" : "border-base-content/10",
          ]}
        >
          <p class="flex items-center gap-2 text-sm font-medium">
            <span class="tabular text-xs text-error">02</span>
            연결 해제
          </p>
          <p class="text-xs leading-relaxed text-base-content/50">
            이 기기를 체인에서 뺍니다. 이 기기의 데이터는 그대로 유지됩니다.
          </p>

          {#if confirming}
            <div class="mt-auto flex gap-2">
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
                해제
              </button>
            </div>
          {:else}
            <button
              class="btn btn-ghost btn-sm mt-auto text-error"
              onclick={() => (confirming = true)}
            >
              <Icon icon="lucide:unlink" class="size-4" />
              연결 해제
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if failure}
      <p class="whitespace-pre-wrap break-all text-xs text-error">{failure}</p>
    {/if}
  </Section>

  <Group title="동기화 항목">
    {#each syncedCollections as name (name)}
      {@const item = COLLECTIONS[name]}
      <Row label={item.label} hint={item.hint} icon={item.icon}>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          checked={settings.collections[name]}
          aria-label={item.label}
          onchange={() => toggle(name)}
        />
      </Row>
    {/each}

    <Row
      label="자동 동기화 주기"
      hint="앱이 열려 있는 동안 이 간격으로 연결된 기기와 맞춥니다."
      icon="lucide:timer"
    >
      <Segmented
        label="자동 동기화 주기"
        options={INTERVALS}
        value={settings.intervalMinutes}
        onchange={minutes => patchSync({ intervalMinutes: minutes })}
      />
    </Row>
  </Group>
{/if}
