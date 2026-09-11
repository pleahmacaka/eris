<script lang="ts">
import Icon from "@iconify/svelte"
import type { Feed } from "$lib/server/activity"
import Matrix from "./Matrix.svelte"

let {
  feed,
  source,
  icon,
  stat,
}: { feed: Feed; source: string; icon: string; stat: string } = $props()
</script>

<div class="flex flex-col gap-4">
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <a
      class="link link-hover flex items-center gap-2 font-medium text-sm"
      href={feed.href}
      rel="noreferrer"
      target="_blank"
    >
      <Icon class="size-4 shrink-0 self-center" {icon} />
      {source}
    </a>
    <p class="text-neutral-content/65 text-sm">{stat}</p>
  </div>

  <Matrix days={feed.days} label="{source}: {stat}" />
</div>
