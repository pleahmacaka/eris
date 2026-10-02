<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { toast } from "@eris/ui"
  import { writeText } from "@tauri-apps/plugin-clipboard-manager"
  import { t } from "svelte-i18n"
  import { formatBytes, formatDate } from "../../format"
  import ExpiryPicker from "./ExpiryPicker.svelte"
  import Qr from "./Qr.svelte"
  import { type Item, type Outgoing, revoke, setExpiry } from "./share"
  import { peerName, share } from "./share.svelte"

  let shown = $state<string | null>(null)
  let editing = $state<string | null>(null)

  const subject = (items: Item[]) =>
    items.length === 1
      ? items[0].name
      : $t("share.andMore", {
          values: { name: items[0]?.name ?? "", count: items.length - 1 },
        })

  const copy = async (link: string) => {
    await writeText(link)
    toast($t("share.copied"), "success")
  }

  const audience = (item: Outgoing) =>
    item.public
      ? $t("share.linkShare")
      : item.devices.map(device => peerName(device)).join(", ")

  const expiry = (at: number | null) =>
    at === null
      ? $t("share.expiryOptions.never")
      : $t("share.expiresAt", {
          values: { date: formatDate(at, currentLocale()) },
        })
</script>

{#if share.state.shares.length === 0}
  <p class="py-6 text-center text-sm text-base-content/60">{$t("share.sentEmpty")}</p>
{:else}
  <ul class="flex flex-col gap-2">
    {#each share.state.shares as item (item.id)}
      <li class="flex flex-col gap-2 rounded-box border border-base-content/10 p-3">
        <div class="flex items-start gap-3">
          <Icon
            icon={item.public ? "lucide:link" : "lucide:monitor-smartphone"}
            class="mt-0.5 size-5 shrink-0 text-base-content/70"
          />

          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-sm font-medium">{subject(item.items)}</span>
            <span class="truncate text-xs text-base-content/60 tabular-nums">
              {audience(item)},
              {formatBytes(item.total, currentLocale())},
              {formatDate(item.createdAt, currentLocale())}
            </span>
          </div>

          <button
            type="button"
            class="btn btn-ghost btn-xs shrink-0 gap-1 tabular-nums"
            aria-expanded={editing === item.id}
            onclick={() => (editing = editing === item.id ? null : item.id)}
          >
            <Icon icon="lucide:clock" class="size-3.5" />
            {expiry(item.expiresAt)}
          </button>
        </div>

        {#if editing === item.id}
          <ExpiryPicker
            choice={item.expiresAt === null ? "never" : "custom"}
            value={item.expiresAt}
            onchange={value => setExpiry(item.id, value).catch(() => undefined)}
          />
        {/if}

        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-base-content/60">
            {$t("share.downloads")}
          </span>

          {#each item.downloads as entry (entry.device)}
            <span class="flex items-center gap-2 text-xs">
              <Icon icon="lucide:download" class="size-3.5 text-base-content/50" />
              <span class="min-w-0 flex-1 truncate">{peerName(entry.device)}</span>
              <span class="text-base-content/60 tabular-nums">
                {formatDate(entry.at, currentLocale())}
              </span>
            </span>
          {:else}
            <span class="text-xs text-base-content/50">{$t("share.noDownloads")}</span>
          {/each}
        </div>

        <div class="flex flex-wrap gap-2">
          {#if item.public}
            <button type="button" class="btn btn-xs btn-soft" onclick={() => copy(item.link)}>
              <Icon icon="lucide:copy" class="size-3.5" />
              {$t("share.copyLink")}
            </button>

            <button
              type="button"
              class="btn btn-xs btn-soft"
              aria-pressed={shown === item.id}
              onclick={() => (shown = shown === item.id ? null : item.id)}
            >
              <Icon icon="lucide:qr-code" class="size-3.5" />
              {$t("share.qr")}
            </button>
          {/if}

          <button
            type="button"
            class="btn btn-xs btn-ghost"
            onclick={() => revoke(item.id).catch(() => undefined)}
          >
            <Icon icon="lucide:link-2-off" class="size-3.5" />
            {$t("share.stop")}
          </button>
        </div>

        {#if shown === item.id}
          <Qr text={item.link} label={$t("share.qr")} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}
