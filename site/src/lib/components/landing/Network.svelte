<script lang="ts">
import Icon from "@iconify/svelte"
import Logo from "#lib/components/brand/Logo.svelte"
import { NETWORK_ICONS } from "#lib/landing/icons.js"
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["network"] } = $props()

const NODE = [
  "flex w-20 flex-col items-center gap-3 text-center text-xs",
  "sm:w-24 sm:text-sm",
]

const BOX = [
  "flex size-16 items-center justify-center rounded-field border",
  "border-base-content/15 bg-base-100",
]

const LINK = "mt-8 h-0.25 min-w-2 flex-1 bg-base-content/20"
</script>

<Section id="matrix" eyebrow={t.eyebrow} title={t.title}>
  <div class="grid gap-3 lg:grid-cols-5">
    <div
      class={[
        "panel-surface flex min-w-0 items-center rounded-box border p-6 sm:p-10",
        "border-base-content/10 lg:col-span-2",
      ]}
    >
      <div class="flex w-full items-start justify-between">
        <div class={NODE}>
          <span class={BOX}><Logo class="size-8" /></span>
          <span>Eris</span>
        </div>

        <span class={LINK} aria-hidden="true"></span>

        <div class={NODE}>
          <span class={BOX}>
            <Icon icon={NETWORK_ICONS.homeserver} class="size-7 text-primary" />
          </span>
          <span class="text-balance">{t.homeserver}</span>
        </div>

        <span class={LINK} aria-hidden="true"></span>

        <div class={NODE}>
          <span class={BOX}>
            <Icon icon={NETWORK_ICONS.protocol} class="size-7 text-secondary" />
          </span>
          <span class="text-balance">{t.network}</span>
        </div>
      </div>
    </div>

    <ul class="grid min-w-0 gap-3 sm:grid-cols-2 lg:col-span-3">
      {#each t.items as item (item.id)}
        <li
          class={[
            "flex flex-col gap-2 rounded-box border p-6",
            "border-base-content/10 bg-base-100/50",
          ]}
        >
          <Icon icon={NETWORK_ICONS[item.id]} class="size-6 text-primary" />
          <h3 class="wrap-break-word font-bold text-lg">{item.title}</h3>
          <p class="text-base-content/70 text-sm">{item.body}</p>
        </li>
      {/each}
    </ul>
  </div>
</Section>
