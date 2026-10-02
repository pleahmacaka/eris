<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { ClassValue } from "svelte/elements"
  import { t } from "svelte-i18n"
  import {
    COMMANDS,
    type CommandId,
    hintOf,
    usable,
  } from "../../store/commands"
  import type { Explorer } from "../../store/explorer.svelte"

  let {
    id,
    explorer,
    text = false,
    pressed,
    spin = false,
  }: {
    id: CommandId
    explorer: Explorer
    text?: boolean
    pressed?: boolean
    spin?: boolean
  } = $props()

  const command = $derived(COMMANDS[id])
  const label = $derived($t(command.label))
  const hint = $derived(hintOf(id))
  const iconClass: ClassValue = $derived(["size-4", spin && "animate-spin"])
</script>

<button
  type="button"
  class={[
    "btn btn-ghost btn-sm",
    text ? "gap-2" : "btn-square",
    pressed && "btn-active",
  ]}
  aria-label={text ? undefined : label}
  aria-pressed={pressed}
  title={hint ? `${label} (${hint})` : label}
  disabled={!usable(id, explorer)}
  onclick={() => command.run(explorer)}
>
  <Icon icon={command.icon} class={iconClass} />

  {#if text}
    {label}
  {/if}
</button>
