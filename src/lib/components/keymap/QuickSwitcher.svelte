<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import Dialog from "#lib/components/ui/Dialog.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { channelsPath, parseChannelsPath } from "#lib/routes.js"
import { visit } from "#lib/shell/visit.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import {
  type SwitcherItem,
  searchSwitcher,
  switcherItems,
} from "#lib/switcher/switcher.js"
import { page } from "$app/state"

type Props = { open: boolean; recent: readonly string[]; onclose: () => void }

let { open, recent, onclose }: Props = $props()

const LIMIT = 30

const FILTERS: { key: string; label: MessageKey }[] = [
  { key: "@", label: "switcher.filter.dm" },
  { key: "#", label: "channels.text.title" },
  { key: "!", label: "voice.stage.label" },
  { key: "*", label: "switcher.detail.space" },
]

const HINTS: { keys: string[]; label: MessageKey }[] = [
  { keys: ["↑", "↓"], label: "switcher.hint.move" },
  { keys: ["Enter"], label: "switcher.hint.open" },
]

let query = $state("")
let active = $state(0)

const here = $derived(parseChannelsPath(page.url.pathname)?.roomId ?? null)
const items = $derived(
  open
    ? switcherItems({
        spaces: chatStore.spaces,
        channels: chatStore.joinedChannels,
        dms: chatStore.dms,
        friends: chatStore.friends,
      })
    : [],
)
const elsewhere = $derived(
  here === null ? items : items.filter(item => item.roomId !== here),
)
const results = $derived(
  searchSwitcher(query === "" ? elsewhere : items, query, recent).slice(
    0,
    LIMIT,
  ),
)

const optionId = (index: number) => `switcher-option-${index}`

$effect(() => {
  if (open) {
    query = ""
    active = 0
  }
})

const search = (text: string) => {
  query = text
  active = 0
}

const move = (step: 1 | -1) => {
  if (results.length > 0) {
    active = (active + step + results.length) % results.length
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" })
  }
}

const choose = (item: SwitcherItem | undefined) => {
  if (item) {
    onclose()
    visit(channelsPath({ spaceId: item.spaceId, roomId: item.roomId }))
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.isComposing) {
    return
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault()
    move(event.key === "ArrowDown" ? 1 : -1)
  } else if (event.key === "Enter") {
    event.preventDefault()
    choose(results[active])
  }
}
</script>

<Dialog {open} title={i18n.t("keymap.action.quickSwitch")} {onclose}>
  <label class="input w-full">
    <Icon icon="lucide:search" class="size-4 text-subtle" />
    <input
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      placeholder={i18n.t("switcher.placeholder")}
      aria-label={i18n.t("keymap.action.quickSwitch")}
      aria-expanded={results.length > 0}
      aria-controls="switcher-options"
      aria-autocomplete="list"
      aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
      value={query}
      oninput={event => search(event.currentTarget.value)}
      onkeydown={onKeydown}
    />
  </label>

  <div class="h-80 overflow-y-auto">
    {#if results.length === 0}
      <p class="py-10 text-center text-subtle text-sm">{i18n.t("ui.noResults")}</p>
    {:else}
      <div
        id="switcher-options"
        role="listbox"
        aria-label={i18n.t("switcher.results")}
        class="flex flex-col gap-0.5"
      >
        {#each results as item, index (item.key)}
          <button
            type="button"
            id={optionId(index)}
            role="option"
            tabindex="-1"
            aria-selected={index === active}
            class={[
              "flex w-full cursor-pointer items-center gap-3 rounded-field px-2 py-1.5",
              "text-start",
              index === active
                ? "bg-base-content/10 text-base-content"
                : "text-muted",
            ]}
            onpointermove={() => {
              active = index
            }}
            onmousedown={event => event.preventDefault()}
            onclick={() => choose(item)}
          >
            {#if item.kind === "text" || item.kind === "voice"}
              <span class="flex size-6 shrink-0 items-center justify-center">
                <Icon
                  icon={item.kind === "voice" ? "lucide:volume-2" : "lucide:hash"}
                  class="size-4"
                />
              </span>
            {:else}
              <Avatar
                name={item.name}
                mxc={item.avatarUrl}
                size="xs"
                tone={item.kind === "dm" ? "primary" : "neutral"}
              />
            {/if}
            <span class="min-w-0 flex-1 truncate">{item.name}</span>
            {#if item.unread > 0}
              <span class="badge badge-primary badge-xs whitespace-nowrap tabular-nums">
                {item.unread > 99
                  ? i18n.t("chat.unread.overflow", { count: 99 })
                  : i18n.format.number(item.unread)}
              </span>
            {/if}
            <span class="max-w-2/5 shrink-0 truncate text-subtle text-xs">
              {i18n.text(item.detail)}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div
    class={[
      "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3",
      "border-base-content/10 text-subtle text-xs",
    ]}
  >
    <ul class="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label={i18n.t("switcher.filters")}>
      {#each FILTERS as filter (filter.key)}
        <li class="flex items-center gap-1.5">
          <kbd class="kbd kbd-xs">{filter.key}</kbd>
          {i18n.t(filter.label)}
        </li>
      {/each}
    </ul>
    <ul class="hidden items-center gap-x-3 sm:flex" aria-label={i18n.t("switcher.keyboard")}>
      {#each HINTS as hint (hint.label)}
        <li class="flex items-center gap-1.5">
          {#each hint.keys as key (key)}
            <kbd class="kbd kbd-xs">{key}</kbd>
          {/each}
          {i18n.t(hint.label)}
        </li>
      {/each}
    </ul>
  </div>
</Dialog>
