<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { Logo } from "@eris/ui"
  import { t } from "svelte-i18n"
  import Devices from "./components/share/Devices.svelte"
  import Inbox from "./components/share/Inbox.svelte"
  import Sent from "./components/share/Sent.svelte"
  import ShareDialog from "./components/share/ShareDialog.svelte"
  import { openShare, share, startShare } from "./components/share/share.svelte"
  import { formatBytes } from "./format"
  import { call } from "./native"

  type Tab = "files" | "inbox" | "sent" | "devices"

  type LocalEntry = { name: string; path: string; dir: boolean; size: number }

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "files", icon: "lucide:folder", label: "share.files" },
    { id: "inbox", icon: "lucide:inbox", label: "share.inbox" },
    { id: "sent", icon: "lucide:send", label: "share.sentTab" },
    { id: "devices", icon: "lucide:monitor-smartphone", label: "devices.title" },
  ]

  let tab = $state<Tab>("files")
  let sub = $state<string[]>([])
  let entries = $state<LocalEntry[]>([])

  $effect(() => startShare())

  $effect(() => {
    if (share.center) {
      tab = "inbox"
      share.center = false
    }
  })

  $effect(() => {
    void share.state.inbox

    if (tab !== "files") {
      return
    }

    call<LocalEntry[]>("share_files", { sub: sub.join("/") })
      .then(next => {
        entries = next
      })
      .catch(() => {
        entries = []
      })
  })

  const scan = async () => {
    const scanner = await import("@tauri-apps/plugin-barcode-scanner")

    if ((await scanner.requestPermissions()) !== "granted") {
      return null
    }

    const scanned = await scanner.scan({ formats: [scanner.Format.QRCode] })

    return scanned.content
  }
</script>

<main class="flex h-dvh flex-col">
  <header class="flex items-center gap-2 border-b border-base-content/10 px-4 py-3">
    <Logo class="size-6" />
    <h1 class="text-base font-semibold">Eris Files</h1>
  </header>

  <section class="min-h-0 flex-1 overflow-y-auto p-4">
    {#if tab === "files"}
      <div class="flex flex-col gap-1">
        {#if sub.length > 0}
          <button
            type="button"
            class="btn btn-ghost justify-start"
            onclick={() => (sub = sub.slice(0, -1))}
          >
            <Icon icon="lucide:arrow-left" class="size-4" />
            {$t("share.up")}
          </button>
        {/if}

        {#if entries.length === 0}
          <p class="py-10 text-center text-sm text-base-content/60">{$t("share.filesEmpty")}</p>
        {/if}

        {#each entries as entry (entry.path)}
          <div class="flex items-center gap-3 rounded-field px-2 py-2.5">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-3 text-left"
              disabled={!entry.dir}
              onclick={() => (sub = [...sub, entry.name])}
            >
              <Icon
                icon={entry.dir ? "lucide:folder" : "lucide:file"}
                class="size-5 shrink-0 text-base-content/70"
              />
              <span class="flex min-w-0 flex-col">
                <span class="truncate text-sm">{entry.name}</span>
                {#if !entry.dir}
                  <span class="text-xs tabular-nums text-base-content/60">
                    {formatBytes(entry.size, currentLocale())}
                  </span>
                {/if}
              </span>
            </button>

            <button
              type="button"
              class="btn btn-ghost btn-square btn-sm"
              aria-label={$t("share.action")}
              onclick={() => openShare([entry.path])}
            >
              <Icon icon="lucide:share-2" class="size-4" />
            </button>
          </div>
        {/each}
      </div>
    {:else if tab === "inbox"}
      <Inbox />
    {:else if tab === "sent"}
      <Sent />
    {:else}
      <Devices {scan} />
    {/if}
  </section>

  <nav
    class="grid grid-cols-4 border-t border-base-content/10"
    style:padding-bottom="env(safe-area-inset-bottom)"
  >
    {#each TABS as item (item.id)}
      <button
        type="button"
        class={[
          "flex flex-col items-center gap-1 py-2.5 text-xs",
          tab === item.id ? "text-primary" : "text-base-content/60",
        ]}
        aria-pressed={tab === item.id}
        onclick={() => (tab = item.id)}
      >
        <Icon icon={item.icon} class="size-5" />
        {$t(item.label)}
      </button>
    {/each}
  </nav>
</main>

<ShareDialog />
