<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Explorer } from "../../store/explorer.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import { terminal } from "../../store/terminal.svelte"
  import AddressBar from "./AddressBar.svelte"
  import CommandBar from "./CommandBar.svelte"
  import CommandButton from "./CommandButton.svelte"

  let { explorer }: { explorer: Explorer } = $props()

  let field = $state<HTMLInputElement>()
  let address = $state<ReturnType<typeof AddressBar>>()
  let timer = 0

  const tab = $derived(explorer.tab)

  const schedule = (value: string) => {
    clearTimeout(timer)
    tab.query = value
    timer = window.setTimeout(() => tab.search(value), 280)
  }

  const runNow = () => {
    clearTimeout(timer)
    tab.search(tab.query)
  }

  const clear = () => {
    clearTimeout(timer)
    tab.clearSearch()
  }

  export const focusSearch = () => {
    field?.focus()
    field?.select()
  }

  export const editAddress = () => address?.edit()
</script>

<div
  class={[
    "flex shrink-0 items-center gap-1 px-2 py-1.5",
    prefs.compactToolbar && "border-b border-base-content/10",
  ]}
>
  <CommandButton id="back" {explorer} />

  <CommandButton id="forward" {explorer} />

  <CommandButton id="up" {explorer} />

  <CommandButton id="refresh" {explorer} spin={tab.loading} />

  <AddressBar bind:this={address} {explorer} />

  <label class="input input-sm h-8 w-72 shrink-0 gap-2">
    <Icon icon="lucide:search" class="size-4 shrink-0 text-base-content/50" />

    <input
      bind:this={field}
      type="search"
      class="grow select-text"
      spellcheck="false"
      aria-label={$t("explorer.nav.searchAria")}
      placeholder={$t("explorer.nav.search", {
        values: { name: explorer.title(tab, $t) },
      })}
      value={tab.query}
      oninput={e => schedule(e.currentTarget.value)}
      onkeydown={e => {
        if (e.key === "Enter") {
          runNow()
        }

        if (e.key === "Escape") {
          clear()
          e.currentTarget.blur()
        }
      }}
    />

    {#if tab.searching}
      <span class="loading loading-spinner loading-xs text-primary"></span>
    {:else if tab.query}
      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs"
        aria-label={$t("common.clear")}
        onclick={clear}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    {/if}
  </label>

  <CommandButton id="terminal" {explorer} pressed={terminal.open} />

  {#if prefs.compactToolbar}
    <CommandBar {explorer} compact />
  {/if}
</div>
