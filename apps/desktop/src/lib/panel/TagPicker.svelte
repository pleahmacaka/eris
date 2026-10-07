<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { EventTag } from "@eris/settings"
  import { t } from "svelte-i18n"
  import { tagLabel } from "$lib/calendar"
  import { colorMeta, eventColors, toColor } from "./colors"
  import type { Panel } from "./panel.svelte"

  let { panel, selected = $bindable() }: { panel: Panel; selected: string[] } =
    $props()

  let query = $state("")
  let editing = $state<string | null>(null)
  let confirming = $state(false)

  const tags = $derived(panel.profile.calendar.tags)

  const needle = $derived(query.trim())

  const match = $derived(tags.find(tag => tagLabel(tag) === needle))

  const shown = $derived(
    needle
      ? tags.filter(tag =>
          tagLabel(tag).toLowerCase().includes(needle.toLowerCase()),
        )
      : tags,
  )

  const toggle = (id: string) => {
    selected = selected.includes(id)
      ? selected.filter(tag => tag !== id)
      : [...selected, id]
  }

  const submit = () => {
    if (match) {
      toggle(match.id)
    } else if (needle) {
      selected = [...selected, panel.createTag(needle)]
    }

    query = ""
  }

  const edit = (id: string) => {
    editing = editing === id ? null : id
    confirming = false
  }

  const rename = (tag: EventTag, value: string) => {
    const name = value.trim()

    if (name && name !== tagLabel(tag)) {
      panel.updateTag(tag.id, { name })
    }
  }

  const remove = (tag: EventTag) => {
    if (selected.includes(tag.id)) {
      selected = selected.filter(id => id !== tag.id)
    }

    panel.removeTag(tag.id)
    editing = null
    confirming = false
  }
</script>

<div class="flex flex-col gap-1">
  <input
    class="input input-sm w-full"
    aria-label={$t("panel.tags.search")}
    placeholder={$t("panel.tags.search")}
    bind:value={query}
    {@attach node => node.focus()}
    onkeydown={e => {
      if (e.key === "Enter") {
        e.preventDefault()
        submit()
      }
    }}
  />

  <ul class="-mx-1 flex max-h-72 flex-col overflow-y-auto">
    {#each shown as tag (tag.id)}
      {@const color = toColor(tag.color)}
      {@const on = selected.includes(tag.id)}
      <li class="group flex items-center rounded-field hover:bg-base-content/6">
        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
          aria-pressed={on}
          onclick={() => toggle(tag.id)}
        >
          <span class={["size-2.5 shrink-0 rounded-full", colorMeta[color].chip]}></span>
          <span class="truncate">{tagLabel(tag)}</span>

          {#if tag.hideWhileSharing}
            <Icon icon="lucide:eye-off" class="size-3 shrink-0 text-base-content/50" />
          {/if}

          {#if on}
            <Icon icon="lucide:check" class="ml-auto size-3.5 shrink-0 text-primary" />
          {/if}
        </button>

        <button
          type="button"
          class={[
            "btn btn-ghost btn-square btn-xs mr-1 opacity-0 transition-opacity duration-120",
            "group-hover:opacity-100 focus-visible:opacity-100",
            editing === tag.id && "opacity-100",
          ]}
          aria-label={$t("panel.tags.edit")}
          aria-expanded={editing === tag.id}
          onclick={() => edit(tag.id)}
        >
          <Icon icon="lucide:ellipsis" class="size-3.5" />
        </button>
      </li>

      {#if editing === tag.id}
        <li class="mx-1 mb-1 flex flex-col gap-2 rounded-field bg-base-content/5 p-2">
          <input
            class="input input-xs w-full"
            aria-label={$t("panel.tags.name")}
            value={tagLabel(tag)}
            onchange={e => rename(tag, e.currentTarget.value)}
            onkeydown={e => e.key === "Enter" && e.currentTarget.blur()}
          />

          <div class="flex flex-wrap gap-1.5 px-0.5">
            {#each eventColors as option (option)}
              <button
                type="button"
                class={[
                  "size-5 cursor-pointer rounded-full ring-2 ring-offset-2 ring-offset-base-100",
                  "transition-shadow duration-120",
                  colorMeta[option].chip,
                  color === option ? "ring-base-content/80" : "ring-transparent hover:ring-base-content/25",
                ]}
                aria-label={$t(colorMeta[option].label)}
                aria-pressed={color === option}
                onclick={() => panel.updateTag(tag.id, { color: option })}
              ></button>
            {/each}
          </div>

          <label class="flex cursor-pointer items-center justify-between gap-2 text-xs">
            <span class="flex items-center gap-1.5">
              <Icon icon="lucide:eye-off" class="size-3.5" />
              {$t("panel.tags.hide")}
            </span>

            <input
              type="checkbox"
              class="toggle toggle-primary toggle-xs"
              checked={tag.hideWhileSharing}
              onchange={e => panel.updateTag(tag.id, { hideWhileSharing: e.currentTarget.checked })}
            />
          </label>

          {#if confirming}
            <div class="flex items-center gap-1 text-xs">
              <span class="flex-1">{$t("panel.tags.confirmDelete")}</span>

              <button type="button" class="btn btn-ghost btn-xs text-error" onclick={() => remove(tag)}>
                {$t("common.delete")}
              </button>

              <button type="button" class="btn btn-ghost btn-xs" onclick={() => (confirming = false)}>
                {$t("common.cancel")}
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="btn btn-ghost btn-xs justify-start text-error"
              onclick={() => (confirming = true)}
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
              {$t("panel.tags.delete")}
            </button>
          {/if}
        </li>
      {/if}
    {/each}

    {#if needle && !match}
      <li>
        <button
          type="button"
          class="flex w-full cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-left hover:bg-base-content/6"
          onclick={submit}
        >
          <Icon icon="lucide:plus" class="size-3.5 shrink-0" />
          <span class="truncate">{$t("panel.tags.create", { values: { name: needle } })}</span>
        </button>
      </li>
    {/if}
  </ul>
</div>
