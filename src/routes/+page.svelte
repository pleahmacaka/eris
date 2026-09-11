<script lang="ts">
import Icon from "@iconify/svelte"
import Reading from "$lib/components/activity/Reading.svelte"
import GearCard from "$lib/components/gear/GearCard.svelte"
import LocaleSwitch from "$lib/components/locale/LocaleSwitch.svelte"
import StackCard from "$lib/components/stack/StackCard.svelte"
import { gear } from "$lib/data/gear"
import { capabilities } from "$lib/data/stack"
import * as m from "$lib/paraglide/messages"
import { getLocale } from "$lib/paraglide/runtime"

let { data } = $props()

const format = (value: number) => value.toLocaleString(getLocale())
</script>

<div
  class={[
    "mx-auto flex min-h-dvh max-w-5xl flex-col",
    "gap-10 px-5 py-12 sm:gap-14 sm:px-8 sm:py-20",
  ]}
>
  <header class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="font-extrabold text-5xl tracking-tight sm:text-6xl">
        ArixLab
      </h1>

      <LocaleSwitch />
    </div>

    <p class="max-w-prose text-base-content/75 leading-relaxed">
      {m.tagline()}
    </p>

    <nav class="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium text-sm">
      <a
        class="link link-hover flex items-center gap-2"
        href="https://github.com/pleahmacaka"
        rel="me noreferrer"
        target="_blank"
      >
        <Icon class="size-4 shrink-0 self-center" icon="simple-icons:github" />
        GitHub
      </a>
      <a
        class="link link-hover flex items-center gap-2"
        href="https://www.npmjs.com/~pleahmacaka"
        rel="me noreferrer"
        target="_blank"
      >
        <Icon class="size-4 shrink-0 self-center" icon="simple-icons:npm" />
        npm
      </a>
      <a
        class="link link-hover flex items-center gap-2"
        href="https://tokscale.ai/u/pleahmacaka"
        rel="me noreferrer"
        target="_blank"
      >
        <Icon class="size-4 shrink-0 self-center" icon="lucide:activity" />
        Tokscale
      </a>
    </nav>
  </header>

  {#if data.githubFeed || data.tokscaleFeed}
    <section
      class={[
        "rounded-box bg-neutral text-neutral-content",
        "flex flex-col gap-6 p-5 sm:gap-7 sm:p-7",
      ]}
      aria-label={m.section_activity()}
    >
      {#if data.githubFeed}
        <Reading
          feed={data.githubFeed}
          icon="simple-icons:github"
          source="GitHub"
          stat={m.contributions({ count: format(data.githubFeed.count) })}
        />
      {/if}

      {#if data.githubFeed && data.tokscaleFeed}
        <hr class="border-neutral-content/15" />
      {/if}

      {#if data.tokscaleFeed}
        <Reading
          feed={data.tokscaleFeed}
          icon="lucide:activity"
          source="Tokscale"
          stat={m.active_days({ count: format(data.tokscaleFeed.count) })}
        />
      {/if}
    </section>
  {/if}

  <section class="grid gap-4 sm:grid-cols-2" aria-label={m.section_work()}>
    {#each capabilities as capability (capability.title())}
      <StackCard {capability} />
    {/each}
  </section>

  <section class="flex flex-col gap-4" aria-label={m.section_gear()}>
    <h2 class="font-semibold text-base-content/55 text-sm">
      {m.section_gear()}
    </h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each gear as group (group.label())}
        <GearCard {group} />
      {/each}
    </div>
  </section>

  <footer
    class={[
      "mt-auto flex flex-wrap items-center justify-between gap-4",
      "border-base-300 border-t pt-6 text-base-content/70 text-sm",
    ]}
  >
    <p>arixlab.com</p>

    <LocaleSwitch />
  </footer>
</div>
