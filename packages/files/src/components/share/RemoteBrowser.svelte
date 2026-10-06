<script lang="ts">
  import Icon from "@iconify/svelte"
  import { toast } from "@eris/ui"
  import { locale, t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { openItem } from "../../native"
  import { browseDevice, fetchRemote, type Member, type RemoteEntry } from "./share"

  const POLL = 2_000
  const WAIT_LIMIT = 120_000
  const FETCH_LIMIT = 600_000

  type Crumb = { name: string; path: string | null }

  type Status = "loading" | "waiting" | "denied" | "failed" | "ready"

  let { device, onclose }: { device: Member; onclose: () => void } = $props()

  let crumbs = $state<Crumb[]>([])
  let entries = $state<RemoteEntry[]>([])
  let status = $state<Status>("loading")
  let opening = $state<string | null>(null)
  let dialog = $state<HTMLDialogElement>()
  let token = 0

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const load = async (path: string | null) => {
    const mine = ++token
    const started = Date.now()

    status = "loading"

    while (mine === token) {
      try {
        const result = await browseDevice(device.id, path)

        if (mine !== token) {
          return
        }

        if (result.kind === "listing") {
          entries = result.entries
          status = "ready"

          return
        }

        if (result.kind === "denied") {
          status = "denied"

          return
        }

        status = "waiting"
      } catch {
        if (mine === token) {
          status = "failed"
        }

        return
      }

      if (Date.now() - started > WAIT_LIMIT) {
        status = "failed"

        return
      }

      await sleep(POLL)
    }
  }

  const go = (index: number) => {
    crumbs = crumbs.slice(0, index + 1)
    load(crumbs[index].path)
  }

  const enter = (entry: RemoteEntry) => {
    crumbs = [...crumbs, { name: entry.name, path: entry.path }]
    load(entry.path)
  }

  const open = async (entry: RemoteEntry) => {
    const started = Date.now()

    opening = entry.path

    try {
      let saved = await fetchRemote(device.id, entry.path)

      while (saved === null) {
        if (Date.now() - started > FETCH_LIMIT) {
          throw new Error("timeout")
        }

        await sleep(POLL)
        saved = await fetchRemote(device.id, entry.path)
      }

      toast($t("remote.saved"), "success")
      await openItem(saved).catch(() => undefined)
    } catch {
      toast($t("remote.failed"), "error")
    } finally {
      opening = null
    }
  }

  const close = () => {
    token += 1
    onclose()
  }

  $effect(() => {
    dialog?.showModal()
  })

  $effect(() => {
    crumbs = [{ name: device.name, path: null }]
    load(null)
  })
</script>

<dialog bind:this={dialog} class="modal" onclose={close}>
  <div class="modal-box flex max-h-[80vh] w-full max-w-lg flex-col gap-3 p-4">
    <header class="flex items-center gap-2">
      <Icon icon="lucide:folder-search" class="size-4 shrink-0 text-base-content/60" />

      <nav
        class="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        aria-label={$t("remote.location")}
      >
        {#each crumbs as crumb, index (index)}
          {#if index > 0}
            <Icon icon="lucide:chevron-right" class="size-3.5 shrink-0 text-base-content/40" />
          {/if}

          <button
            type="button"
            class="btn btn-ghost btn-xs shrink-0"
            disabled={index === crumbs.length - 1}
            onclick={() => go(index)}
          >
            {crumb.name}
          </button>
        {/each}
      </nav>

      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm"
        aria-label={$t("remote.close")}
        onclick={() => dialog?.close()}
      >
        <Icon icon="lucide:x" class="size-4" />
      </button>
    </header>

    <div class="min-h-48 overflow-y-auto">
      {#if status === "ready"}
        {#if entries.length === 0}
          <p class="py-10 text-center text-sm text-base-content/60">{$t("remote.empty")}</p>
        {:else}
          <ul class="flex flex-col">
            {#each entries as entry (entry.path)}
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-field px-2 py-1.5 text-left hover:bg-base-content/5"
                  disabled={opening !== null}
                  onclick={() => (entry.dir ? enter(entry) : open(entry))}
                >
                  <Icon
                    icon={entry.dir ? "lucide:folder" : "lucide:file"}
                    class="size-4 shrink-0 text-base-content/60"
                  />

                  <span class="min-w-0 flex-1 truncate text-sm">{entry.name}</span>

                  {#if opening === entry.path}
                    <span class="loading loading-spinner loading-xs"></span>
                  {:else if !entry.dir}
                    <span class="text-xs text-base-content/50 tabular-nums">
                      {formatBytes(entry.size, $locale ?? "en")}
                    </span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if status === "loading"}
        <div class="flex justify-center py-10">
          <span class="loading loading-spinner loading-sm text-base-content/50"></span>
        </div>
      {:else}
        <div class="flex flex-col items-center gap-1 py-10 text-center">
          <p class="text-sm font-medium">{$t(`remote.states.${status}`)}</p>

          {#if status === "waiting"}
            <p class="text-xs text-base-content/60">{$t("remote.waitingHint")}</p>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button>{$t("remote.close")}</button>
  </form>
</dialog>
