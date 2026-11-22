<script lang="ts">
import type { MockCopy } from "#lib/server/mock.js"
import MockAvatar from "./MockAvatar.svelte"

let { t }: { t: MockCopy } = $props()
</script>

<div
  class={[
    "panel-surface hidden w-40 shrink-0 flex-col border-s px-2 py-1",
    "border-base-content/10 @3xl:flex",
  ]}
>
  {#each t.members as group (group.role)}
    <p
      class={[
        "flex items-center gap-2 px-1 pt-3 pb-1 font-semibold",
        "text-2xs text-base-content/60",
      ]}
    >
      <span class="min-w-0 truncate">{group.role}</span>
      <span class="tabular-nums">{group.count}</span>
    </p>

    {#each group.people as person (person.name)}
      <div
        class={[
          "flex h-9 items-center gap-2 px-1",
          person.presence === "offline" && "opacity-60",
        ]}
      >
        <MockAvatar
          name={person.name}
          size="sm"
          presence={person.presence}
          ring="border-base-200"
        />
        <span class="min-w-0 truncate font-medium text-xs">{person.name}</span>
      </div>
    {/each}
  {/each}
</div>
