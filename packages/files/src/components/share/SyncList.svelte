<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { toast } from "@eris/ui"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { formatDate } from "../../format"
  import { shareError } from "./errors"
  import FolderPick from "./FolderPick.svelte"
  import {
    type Sync,
    syncAccept,
    syncCreate,
    syncDecline,
    syncNow,
    syncPause,
    syncRemove,
  } from "./share"
  import { peerName, share } from "./share.svelte"

  type Pick = { folder: string; ready: boolean }

  let { folder = null }: { folder?: string | null } = $props()

  let adding = $state(false)
  let draft = $state<Pick>({ folder: "", ready: false })
  let device = $state("")
  let busy = $state(false)
  let picks = $state<Record<string, Pick>>({})

  const open = (prefill: string | null) => {
    adding = true
    draft = { folder: prefill ?? "", ready: false }
    device = share.state.devices[0]?.id ?? ""
  }

  $effect(() => {
    const requested = share.syncFolder

    if (requested) {
      untrack(() => {
        share.syncFolder = null
        open(requested)
      })
    }
  })

  $effect(() => {
    const invites = share.state.syncInvites

    untrack(() => {
      for (const invite of invites) {
        picks[invite.id] ??= { folder: folder ?? "", ready: false }
      }
    })
  })

  const run = async (task: Promise<unknown>) => {
    busy = true

    try {
      await task

      return true
    } catch (reason) {
      toast(shareError(reason), "error")

      return false
    } finally {
      busy = false
    }
  }

  const start = async () => {
    if (await run(syncCreate(draft.folder, device))) {
      adding = false
    }
  }

  const status = (sync: Sync) => {
    if (!sync.linked) {
      return $t("share.sync.waiting")
    }

    if (sync.paused) {
      return $t("share.sync.paused")
    }

    if (sync.error) {
      return shareError(sync.error)
    }

    return sync.syncedAt
      ? $t("share.sync.synced", {
          values: { date: formatDate(sync.syncedAt, currentLocale()) },
        })
      : $t("share.sync.never")
  }
</script>

<div class="flex flex-col gap-3">
  {#each share.state.syncInvites as invite (invite.id)}
    <div class="flex flex-col gap-2 rounded-box border border-primary/30 p-3">
      <span class="text-sm">
        {$t("share.sync.invite", {
          values: { device: peerName(invite.from), name: invite.name },
        })}
      </span>

      {#if picks[invite.id]}
        <FolderPick
          bind:folder={picks[invite.id].folder}
          bind:ready={picks[invite.id].ready}
        />

        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-xs btn-primary"
            disabled={busy || !picks[invite.id].ready}
            onclick={() => run(syncAccept(invite.id, picks[invite.id].folder))}
          >
            {$t("share.sync.accept")}
          </button>

          <button
            type="button"
            class="btn btn-xs btn-ghost"
            onclick={() => run(syncDecline(invite.id))}
          >
            {$t("share.sync.decline")}
          </button>
        </div>
      {/if}
    </div>
  {/each}

  {#each share.state.syncs as sync (sync.id)}
    <div class="flex flex-col gap-2 rounded-box border border-base-content/10 p-3">
      <div class="flex items-start gap-3">
        <Icon icon="lucide:folder-sync" class="mt-0.5 size-5 shrink-0 text-base-content/70" />

        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-sm font-medium" title={sync.folder}>{sync.folder}</span>
          <span
            class={[
              "truncate text-xs tabular-nums",
              sync.linked && !sync.paused && sync.error
                ? "text-warning"
                : "text-base-content/60",
            ]}
          >
            {peerName(sync.device)},
            {$t("share.sync.files", { values: { count: sync.files } })},
            {status(sync)}
          </span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-xs btn-soft"
          disabled={sync.paused || busy}
          onclick={() => run(syncNow(sync.id))}
        >
          <Icon icon="lucide:refresh-cw" class="size-3.5" />
          {$t("share.sync.now")}
        </button>

        <button
          type="button"
          class="btn btn-xs btn-soft"
          onclick={() => run(syncPause(sync.id, !sync.paused))}
        >
          <Icon icon={sync.paused ? "lucide:play" : "lucide:pause"} class="size-3.5" />
          {sync.paused ? $t("share.sync.resume") : $t("share.sync.pause")}
        </button>

        <button
          type="button"
          class="btn btn-xs btn-ghost"
          onclick={() => run(syncRemove(sync.id))}
        >
          <Icon icon="lucide:unlink" class="size-3.5" />
          {$t("share.sync.remove")}
        </button>
      </div>
    </div>
  {/each}

  {#if adding}
    <div class="flex flex-col gap-2 rounded-box border border-base-content/10 p-3">
      <FolderPick bind:folder={draft.folder} bind:ready={draft.ready} />

      {#if share.state.devices.length === 0}
        <p class="text-xs text-base-content/60">{$t("share.sync.noDevices")}</p>
      {:else}
        <select
          class="select select-sm w-full"
          aria-label={$t("share.sync.device")}
          bind:value={device}
        >
          {#each share.state.devices as entry (entry.id)}
            <option value={entry.id}>{entry.name}</option>
          {/each}
        </select>
      {/if}

      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-xs btn-primary"
          disabled={!draft.ready || !device || busy}
          onclick={start}
        >
          {#if busy}
            <span class="loading loading-spinner loading-xs"></span>
          {/if}
          {$t("share.sync.start")}
        </button>

        <button type="button" class="btn btn-xs btn-ghost" onclick={() => (adding = false)}>
          {$t("common.cancel")}
        </button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="btn btn-sm btn-soft justify-start"
      onclick={() => open(folder)}
    >
      <Icon icon="lucide:folder-sync" class="size-4" />
      {$t("share.sync.add")}
    </button>
  {/if}
</div>
