<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockAvatar from "./MockAvatar.svelte"

type Props = {
  t: MockCopy
  title: string
  children: Snippet
  footer?: Snippet
}

let { t, title, children, footer }: Props = $props()

const demo = useMockDemo()
</script>

<div
  class={[
    "panel-surface min-w-0 flex-1 flex-col border-e border-base-content/10",
    demo?.listOpen ? "flex" : "hidden",
    "@2xl:flex @2xl:w-56 @2xl:flex-none",
  ]}
>
  <div
    class={[
      "flex h-10 shrink-0 items-center border-b px-3 font-semibold",
      "border-base-content/10",
    ]}
  >
    <span class="truncate">{title}</span>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden p-2">
    {@render children()}
  </div>

  {@render footer?.()}

  <div class="flex h-12 shrink-0 items-center gap-2 bg-base-300 px-2">
    <MockAvatar
      name={t.me.name}
      size="sm"
      tone="primary"
      presence={t.me.presence}
      ring="border-base-300"
    />

    <span class="flex min-w-0 flex-1 flex-col">
      <span class="truncate font-semibold text-xs">{t.me.name}</span>
      <span class="truncate text-2xs text-base-content/60">{t.me.status}</span>
    </span>

    <span class="flex shrink-0 items-center gap-2 text-base-content/60">
      <Icon icon="lucide:mic" class="size-3.5" />
      <Icon icon="lucide:headphones" class="size-3.5" />
      <Icon icon="lucide:settings" class="size-3.5" />
    </span>
  </div>
</div>
