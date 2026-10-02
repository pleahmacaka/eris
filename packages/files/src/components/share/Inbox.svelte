<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { shareError } from "./errors"
  import {
    cancel,
    dismiss,
    download,
    fetchShare,
    type Incoming,
    type Item,
    openLink,
  } from "./share"
  import { peerName, share } from "./share.svelte"

  let {
    folder = null,
    reveal,
  }: { folder?: string | null; reveal?: (path: string) => void } = $props()

  let link = $state("")

  const subject = (items: Item[]) =>
    items.length === 1
      ? items[0].name
      : $t("share.andMore", {
          values: { name: items[0]?.name ?? "", count: items.length - 1 },
        })

  const percent = (entry: Incoming) => {
    const total = entry.manifest?.total ?? 0
    const done = share.progress[entry.id] ?? 0

    return total ? Math.min(100, Math.round((done / total) * 100)) : 0
  }

  const run = (task: Promise<unknown>) => {
    task.catch(reason => toast(shareError(reason), "error"))
  }

  const save = (id: string, target: string | null = null) => {
    share.progress[id] = 0
    run(download(id, target))
  }

  const open = async () => {
    const value = link.trim()

    if (!value) {
      return
    }

    link = ""
    run(openLink(value))
  }
</script>

<div class="flex flex-col gap-3">
  <form
    class="flex gap-2"
    onsubmit={e => {
      e.preventDefault()
      open()
    }}
  >
    <input
      class="input input-sm min-w-0 flex-1"
      placeholder={$t("share.pasteLink")}
      aria-label={$t("share.pasteLink")}
      autocomplete="off"
      spellcheck="false"
      bind:value={link}
    />
    <button type="submit" class="btn btn-sm btn-soft" disabled={!link.trim()}>
      {$t("share.openLink")}
    </button>
  </form>

  {#if share.state.inbox.length === 0}
    <p class="py-6 text-center text-sm text-base-content/60">{$t("share.inboxEmpty")}</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each share.state.inbox as entry (entry.id)}
        <li class="flex flex-col gap-2 rounded-box border border-base-content/10 p-3">
          <div class="flex items-start gap-3">
            <Icon
              icon={entry.manifest?.items.length === 1 && !entry.manifest.items[0].dir
                ? "lucide:file"
                : "lucide:folder"}
              class="mt-0.5 size-5 shrink-0 text-base-content/70"
            />

            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium">
                {entry.manifest ? subject(entry.manifest.items) : $t("share.unknownItems")}
              </span>
              <span class="truncate text-xs text-base-content/60 tabular-nums">
                {peerName(entry.from, entry.manifest?.from)}
                {#if entry.manifest}
                  , {formatBytes(entry.manifest.total, currentLocale())}
                {/if}
              </span>
            </div>

            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={$t("share.remove")}
              onclick={() => run(dismiss(entry.id))}
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </div>

          {#if entry.phase === "waiting"}
            <span class="flex items-center gap-2 text-xs text-base-content/60">
              <span class="loading loading-spinner loading-xs"></span>
              {$t("share.stages.waiting")}
            </span>
          {:else if entry.phase === "offline" || entry.phase === "failed"}
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs text-warning">
                {entry.phase === "offline"
                  ? $t("share.stages.offline")
                  : shareError(entry.error)}
              </span>
              <button
                type="button"
                class="btn btn-xs btn-soft"
                onclick={() => run(fetchShare(entry.id))}
              >
                {$t("share.retry")}
              </button>
            </div>
          {:else if entry.phase === "ready"}
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="btn btn-xs btn-primary"
                onclick={() => save(entry.id)}
              >
                <Icon icon="lucide:download" class="size-3.5" />
                {$t("share.saveDownloads")}
              </button>

              {#if folder}
                <button
                  type="button"
                  class="btn btn-xs btn-soft"
                  onclick={() => save(entry.id, folder)}
                >
                  {$t("share.saveHere")}
                </button>
              {/if}
            </div>
          {:else if entry.phase === "receiving"}
            <div class="flex items-center gap-2">
              <progress
                class="progress progress-primary h-1.5 flex-1"
                value={percent(entry)}
                max="100"
                aria-label={$t("share.stages.receiving")}
              ></progress>
              <span class="w-9 text-right text-xs tabular-nums text-base-content/60">
                {percent(entry)}%
              </span>
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                onclick={() => run(cancel(entry.id))}
              >
                {$t("common.cancel")}
              </button>
            </div>
          {:else if entry.phase === "done"}
            <div class="flex items-center justify-between gap-2">
              <span class="flex items-center gap-1.5 text-xs text-success">
                <Icon icon="lucide:check" class="size-3.5" />
                {$t("share.stages.done")}
              </span>

              {#if entry.savedTo && reveal}
                <button
                  type="button"
                  class="btn btn-xs btn-soft"
                  onclick={() => entry.savedTo && reveal(entry.savedTo)}
                >
                  {$t("share.reveal")}
                </button>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
