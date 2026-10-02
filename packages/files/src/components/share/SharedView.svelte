<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { shareError } from "./errors"
  import Inbox from "./Inbox.svelte"
  import Sent from "./Sent.svelte"
  import { reloadShare, share } from "./share.svelte"
  import SyncList from "./SyncList.svelte"

  let {
    folder = null,
    reveal,
  }: { folder?: string | null; reveal?: (path: string) => void } = $props()

  $effect(() => {
    reloadShare()
  })
</script>

<div class="min-h-0 min-w-0 grow overflow-y-auto">
  <div class="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-5">
    {#if share.problem}
      <p class="flex items-start gap-2 rounded-field bg-warning/10 px-3 py-2 text-sm text-warning">
        <Icon icon="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
        {shareError(share.problem)}
      </p>
    {/if}

    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">{$t("share.sections.shared")}</h2>
      <Sent />
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">{$t("share.sections.received")}</h2>
      <Inbox {folder} {reveal} />
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold">{$t("share.sections.sync")}</h2>
      <SyncList {folder} />
    </section>
  </div>
</div>
