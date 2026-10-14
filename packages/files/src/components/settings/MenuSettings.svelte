<script lang="ts">
  import { Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import {
    entryIcon,
    entryLabel,
    LOCKED_ITEMS,
  } from "../../store/menu-entries"
  import { prefs } from "../../store/prefs.svelte"
  import { verbIcon } from "../../store/shell-verbs"
  import OrderList from "./OrderList.svelte"

  const SECTION_ICONS = {
    open: "lucide:square-arrow-out-up-right",
    shell: "lucide:puzzle",
    archive: "lucide:file-archive",
    edit: "lucide:scissors",
    organize: "lucide:pin",
    properties: "lucide:info",
  }

  const verbs = $derived(
    new Map(prefs.shellVerbs.map(verb => [verb.id, verb])),
  )

  const labelOf = (id: string) => verbs.get(id)?.label ?? entryLabel(id)

  const iconOf = (id: string) => {
    const verb = verbs.get(id)

    return verb ? verbIcon(verb.icon) : entryIcon(id)
  }

  const locked = (id: string) => LOCKED_ITEMS.includes(id)
</script>

<Section
  title={$t("explorer.settings.contextMenu.title")}
  description={$t("explorer.settings.order.hint")}
>
  <OrderList
    bind:arrangement={prefs.menuLayout}
    label={$t("explorer.settings.contextMenu.title")}
    labelOf={id => $t(`explorer.settings.contextMenu.sections.${id}`)}
    hintOf={id => $t(`explorer.settings.contextMenu.hints.${id}`)}
    iconOf={id => SECTION_ICONS[id]}
    locked={id => id === "properties"}
  />
</Section>

{#each prefs.menuLayout.order as section (section)}
  {@const title = $t(`explorer.settings.contextMenu.sections.${section}`)}

  <Section
    {title}
    description={section === "shell" && prefs.shellVerbs.length === 0
      ? $t("explorer.settings.contextMenu.shellEmpty")
      : undefined}
  >
    {#if prefs.menuItems[section].order.length > 0}
      <OrderList
        bind:arrangement={prefs.menuItems[section]}
        label={title}
        {labelOf}
        {iconOf}
        {locked}
      />
    {/if}
  </Section>
{/each}
