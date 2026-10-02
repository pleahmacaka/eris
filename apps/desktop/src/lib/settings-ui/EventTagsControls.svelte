<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { EventTag } from "@eris/settings"
  import { t } from "svelte-i18n"
  import { newId } from "$lib/data"
  import { tagLabel } from "$lib/calendar"

  let { tags = $bindable() }: { tags: EventTag[] } = $props()

  const add = () => {
    tags = [...tags, { id: newId(), name: "", hideWhileSharing: false }]
  }

  const remove = (id: string) => {
    tags = tags.filter(tag => tag.id !== id)
  }
</script>

<ul class="flex flex-col gap-1">
  {#each tags as tag (tag.id)}
    <li class="flex items-center gap-2">
      <input
        class="input input-sm min-w-0 flex-1"
        aria-label={$t("settings.rows.tagName")}
        placeholder={tagLabel({ ...tag, name: "" })}
        bind:value={tag.name}
      />

      <label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
        <Icon icon="lucide:eye-off" class="size-3.5 text-base-content/60" />
        {$t("settings.rows.hideWhileSharing")}
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          bind:checked={tag.hideWhileSharing}
        />
      </label>

      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm text-base-content/60 hover:text-error"
        aria-label={$t("settings.rows.deleteTag")}
        onclick={() => remove(tag.id)}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    </li>
  {/each}
</ul>

<button type="button" class="btn btn-ghost btn-sm justify-start" onclick={add}>
  <Icon icon="lucide:plus" class="size-3.5" />
  {$t("settings.rows.addTag")}
</button>
