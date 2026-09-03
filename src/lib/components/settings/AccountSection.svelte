<script lang="ts">
  import Icon from "@iconify/svelte"
  import { goto } from "$app/navigation"
  import Section from "$lib/components/ui/Section.svelte"
  import { patchDevice } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import { syncNow } from "$lib/sync/engine"
  import { signOut } from "$lib/sync/session"
  import { sync } from "$lib/sync/status.svelte"

  let confirming = $state(false)
  let wipeLocal = $state(false)
  let busy = $state(false)

  const settings = $derived(device.value)

  const peers = $derived(settings.sync.peers)

  const online = $derived(sync.peers.filter(p => p.state === "online").length)

  const lastSync = $derived(
    sync.lastSyncAt
      ? new Date(sync.lastSyncAt).toLocaleString("ko-KR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "동기화 기록 없음",
  )

  const summary = $derived(
    sync.state === "syncing"
      ? "동기화 중"
      : sync.state === "error"
        ? "동기화 오류"
        : sync.state === "disabled"
          ? "동기화 꺼짐"
          : `노드 ${online}/${peers.length} 연결`,
  )

  const leave = async () => {
    busy = true

    try {
      await signOut(wipeLocal)
      confirming = false
      wipeLocal = false
    } finally {
      busy = false
    }
  }
</script>

<Section title="계정">
  {#if peers.length === 0}
    <button
      class={[
        "flex cursor-pointer items-center gap-3 rounded-box",
        "bg-base-200 px-4 py-4 text-left active:bg-base-300",
      ]}
      onclick={() => goto("/settings/login")}
    >
      <span
        class={[
          "flex size-10 shrink-0 items-center justify-center",
          "rounded-field bg-primary/15 text-primary",
        ]}
      >
        <Icon icon="lucide:log-in" class="size-5" />
      </span>

      <span class="min-w-0 flex-1">
        <span class="block text-sm font-medium">노드에 로그인</span>
        <span class="block text-xs text-base-content/50">
          로그인하면 메모, 할 일, 일정이 기기 사이에서 동기화됩니다.
        </span>
      </span>

      <Icon icon="lucide:chevron-right" class="size-5 opacity-40" />
    </button>
  {:else}
    <div class="flex flex-col gap-3 rounded-box bg-base-200 px-4 py-4">
      <div class="flex items-center gap-3">
        <span
          class={[
            "flex size-10 shrink-0 items-center justify-center rounded-field",
            online > 0
              ? "bg-success/15 text-success"
              : "bg-base-300 text-base-content/40",
          ]}
        >
          <Icon
            icon={online > 0 ? "lucide:cloud-check" : "lucide:cloud-off"}
            class="size-5"
          />
        </span>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{summary}</p>
          <p class="truncate text-xs text-base-content/50">{lastSync}</p>
        </div>

        <button
          class="btn btn-ghost btn-circle btn-sm"
          aria-label="지금 동기화"
          onclick={syncNow}
        >
          <Icon icon="lucide:refresh-cw" class="size-4" />
        </button>
      </div>

      <label class="floating-label">
        <span>기기 이름</span>
        <input
          class="input input-sm w-full"
          value={settings.deviceName}
          onchange={e =>
            patchDevice({ deviceName: e.currentTarget.value.trim() })}
        />
      </label>

      {#if sync.pending > 0}
        <p class="text-xs text-warning">보낼 항목 {sync.pending}개 대기</p>
      {/if}

      {#if sync.lastError}
        <p class="whitespace-pre-wrap break-all text-xs text-error">
          {sync.lastError}
        </p>
      {/if}

      {#if confirming}
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            bind:checked={wipeLocal}
          />
          이 기기의 메모도 함께 삭제
        </label>

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
            로그아웃
          </button>
        </div>
      {:else}
        <button
          class="btn btn-ghost btn-sm self-start text-error"
          onclick={() => (confirming = true)}
        >
          로그아웃
        </button>
      {/if}
    </div>
  {/if}
</Section>
