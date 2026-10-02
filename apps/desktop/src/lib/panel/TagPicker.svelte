<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { tagLabel } from "$lib/calendar"
  import type { Panel } from "./panel.svelte"

  let { panel, selected = $bindable() }: { panel: Panel; selected: string[] } =
    $props()

  let adding = $state(false)
  let name = $state("")

  const tags = $derived(panel.profile.calendar.tags)

  const toggle = (id: string) => {
    selected = selected.includes(id)
      ? selected.filter(tag => tag !== id)
      : [...selected, id]
  }

  const commit = () => {
    const label = name.trim()

    adding = false
    name = ""

    if (!label) {
      return
    }

    const id =
      tags.find(tag => tagLabel(tag) === label)?.id ?? panel.createTag(label)

    if (!selected.includes(id)) {
      selected = [...selected, id]
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      commit()
    } else if (e.key === "Escape") {
      e.stopPropagation()
      adding = false
      name = ""
    }
  }
</script>

<div class="flex flex-wrap items-center gap-1.5">
  {#each tags as tag (tag.id)}
    <button
      type="button"
      class={[
        "badge badge-sm cursor-pointer gap-1",
        selected.includes(tag.id) ? "badge-primary" : "badge-ghost",
      ]}
      aria-pressed={selected.includes(tag.id)}
      onclick={() => toggle(tag.id)}
    >
      {#if tag.hideWhileSharing}
        <Icon icon="lucide:eye-off" class="size-3" />
      {/if}
      {tagLabel(tag)}
    </button>
  {/each}

  {#if adding}
    <input
      class="input input-xs w-28"
      aria-label={$t("panel.event.newTag")}
      placeholder={$t("panel.event.newTag")}
      bind:value={name}
      {@attach node => node.focus()}
      onblur={commit}
      {onkeydown}
    />
  {:else}
    <button
      type="button"
      class="badge badge-sm badge-ghost cursor-pointer gap-1"
      onclick={() => (adding = true)}
    >
      <Icon icon="lucide:plus" class="size-3" />
      {$t("panel.event.newTag")}
    </button>
  {/if}
</div>
