<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import {
    type SearchEntry,
    type SectionId,
    searchRows,
    searchSections,
  } from "./search"

  let {
    section = $bindable(),
    query = $bindable(),
    onjump,
  }: {
    section: SectionId
    query: string
    onjump: (entry: SearchEntry) => void
  } = $props()

  const found = $derived(searchRows(query, $t))
  const visible = $derived(searchSections(query, $t))
</script>

<nav class="w-44 shrink-0 px-3 pb-4" aria-label={$t("settings.sectionsAria")}>
  <label class="input input-sm mb-2 w-full">
    <Icon icon="lucide:search" class="size-3.5 shrink-0 opacity-50" />

    <input
      type="search"
      placeholder={$t("common.search")}
      aria-label={$t("settings.searchAria")}
      autocomplete="off"
      spellcheck="false"
      bind:value={query}
      onkeydown={e => {
        if (e.key === "Enter" && found[0]) {
          e.preventDefault()
          onjump(found[0])
        }
      }}
    />
  </label>

  <ul class="menu w-full gap-0.5 p-0">
    {#each visible as s (s.id)}
      {@const rows = found.filter(r => r.section === s.id)}
      {@const label = $t(`settings.sections.${s.id}.label`)}

      <li>
        <button
          type="button"
          class={[
            "rounded-field transition-colors duration-150",
            section === s.id && "menu-active",
          ]}
          aria-current={section === s.id ? "page" : undefined}
          onclick={() => (section = s.id)}
        >
          <Icon icon={s.icon} class="size-4" />
          {label}
        </button>

        {#if rows.length}
          <ul>
            {#each rows as r (r.key)}
              <li>
                <button
                  type="button"
                  class="rounded-field text-xs text-base-content/70"
                  onclick={() => onjump(r)}
                >
                  {$t(r.key)}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>

  {#if !visible.length}
    <p class="px-2 py-1 text-xs text-base-content/50">{$t("common.noMatches")}</p>
  {/if}
</nav>
