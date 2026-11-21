<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { MentionOption } from "#lib/matrix/mentions.js"

type Props = {
  options: MentionOption[]
  active: number
  onpick: (option: MentionOption) => void
}

let { options, active, onpick }: Props = $props()

const scrollIntoView = (node: HTMLElement) => {
  node.scrollIntoView({ block: "nearest" })
}
</script>

<div
  role="listbox"
  aria-label={i18n.t("chat.mention.suggestions")}
  class={[
    "absolute inset-x-0 bottom-full z-10 mb-2 flex max-h-72 flex-col overflow-y-auto",
    "rounded-box border border-base-content/10 bg-base-200 p-1 shadow-lg",
  ]}
>
  {#each options as option, index (option.key)}
    <button
      type="button"
      role="option"
      tabindex="-1"
      aria-selected={index === active}
      class={[
        "flex h-10 w-full shrink-0 cursor-pointer items-center gap-2 rounded-field px-2 text-start",
        index === active ? "bg-base-content/10" : "hover:bg-base-content/5",
      ]}
      onmousedown={event => event.preventDefault()}
      onclick={() => onpick(option)}
      {@attach index === active && scrollIntoView}
    >
      {#if option.kind === "user"}
        <Avatar name={option.title} mxc={option.avatarUrl} size="xs" />
      {:else}
        <Icon
          icon={option.kind === "room" ? "lucide:hash" : "lucide:megaphone"}
          class="size-5 shrink-0 text-muted"
        />
      {/if}
      <span class="truncate font-medium text-sm">{option.title}</span>
      <span class="ms-auto min-w-0 truncate ps-3 text-subtle text-xs">
        {option.kind === "everyone"
          ? i18n.t("chat.mention.everyoneDetail")
          : option.detail}
      </span>
    </button>
  {/each}
</div>
