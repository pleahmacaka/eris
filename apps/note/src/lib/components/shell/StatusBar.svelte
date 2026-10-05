<script lang="ts">
  import Icon from "@iconify/svelte"
  import { isNote } from "$lib/vault/paths"
  import { texts, vault } from "$lib/vault/vault.svelte"
  import { basename } from "$lib/vault/paths"
  import { sync } from "$lib/sync/status.svelte"
  import { openView, focusedTab } from "$lib/workspace/workspace.svelte"

  const SYNC: Record<
    typeof sync.state,
    { icon: string; label: string; tone: string }
  > = {
    unsupported: {
      icon: "lucide:cloud-off",
      label: "동기화 미지원",
      tone: "text-base-content/40",
    },
    unpaired: {
      icon: "lucide:link-2-off",
      label: "미연결",
      tone: "text-base-content/50",
    },
    syncing: { icon: "lucide:refresh-cw", label: "동기화 중", tone: "text-info" },
    idle: { icon: "lucide:cloud-check", label: "동기화됨", tone: "text-success" },
    error: {
      icon: "lucide:triangle-alert",
      label: "동기화 오류",
      tone: "text-error",
    },
  }

  const status = $derived(SYNC[sync.state])

  const text = $derived.by(() => {
    const path = focusedTab()?.path

    return path && isNote(path) ? (texts.get(path) ?? null) : null
  })

  const words = $derived(text === null ? 0 : text.split(/\s+/).filter(Boolean).length)

  const chars = $derived(text === null ? 0 : text.replace(/\s/g, "").length)

</script>

<footer
  class={[
    "pad-bottom flex h-6 shrink-0 items-stretch border-t border-base-content/10",
    "bg-base-100 text-xs text-base-content/60 tabular max-lg:hidden",
  ]}
>
  <button
    class={[
      "flex cursor-pointer items-center gap-1.5 px-3 hover:bg-base-content/5",
      status.tone,
    ]}
    onclick={() => openView("settings")}
  >
    <Icon
      icon={status.icon}
      class={["size-3.5", sync.state === "syncing" && "animate-spin"]}
    />
    <span>{status.label}</span>
    {#if sync.peers > 0}
      <span class="text-base-content/45">[{sync.peers}]</span>
    {/if}
  </button>

  <span class="flex items-center gap-1.5 border-l border-base-content/10 px-3">
    <Icon icon="lucide:vault" class="size-3.5 text-primary" />
    {vault.root ? basename(vault.root.replaceAll("\\", "/")) : "볼트"}
  </span>

  <span class="flex-1"></span>

  {#if text !== null}
    <span class="flex items-center border-l border-base-content/10 px-3">
      단어 {words}
    </span>
    <span class="flex items-center border-l border-base-content/10 px-3">
      글자 {chars}
    </span>
  {/if}
</footer>
