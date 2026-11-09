<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Logo } from "@eris/ui"
  import { onBackButtonPress } from "@tauri-apps/api/app"
  import { t } from "svelte-i18n"
  import { keepAlive, sendToBack } from "./components/mobile/mobile"
  import MobileFiles from "./components/mobile/MobileFiles.svelte"
  import Devices from "./components/share/Devices.svelte"
  import { share, startShare } from "./components/share/share.svelte"

  type Tab = "files" | "devices"

  const TABS: { id: Tab; icon: string; label: string }[] = [
    { id: "files", icon: "lucide:folder", label: "share.files" },
    { id: "devices", icon: "lucide:monitor-smartphone", label: "devices.title" },
  ]

  let tab = $state<Tab>("files")
  let files = $state<MobileFiles>()

  $effect(() => startShare())

  $effect(() => {
    if (share.center) {
      tab = "devices"
      share.center = false
    }
  })

  $effect(() => {
    keepAlive(share.state.devices.length > 0)
  })

  $effect(() => {
    const listener = onBackButtonPress(() => {
      if (tab === "devices") {
        tab = "files"
      } else if (!files?.back()) {
        sendToBack().catch(() => undefined)
      }
    })

    return () => {
      listener.then(handle => handle.unregister()).catch(() => undefined)
    }
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

<main class="flex h-dvh flex-col pt-[env(safe-area-inset-top)]">
  <div class={["flex min-h-0 flex-1 flex-col", tab !== "files" && "hidden"]}>
    <MobileFiles bind:this={files} />
  </div>

  {#if tab === "devices"}
    <header class="flex min-h-14 items-center gap-2 border-b border-base-content/10 px-4">
      <Logo class="size-6" />
      <h1 class="text-base font-semibold">Eris Files</h1>
    </header>

    <section class="min-h-0 flex-1 overflow-y-auto p-4">
      <Devices {scan} />
    </section>
  {/if}

  <nav
    class={[
      "grid grid-cols-2 border-t border-base-content/10",
      "pb-[env(safe-area-inset-bottom)]",
    ]}
  >
    {#each TABS as item (item.id)}
      <button
        type="button"
        class={[
          "flex min-h-14 flex-col items-center justify-center gap-1 text-xs active:bg-base-content/10",
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

