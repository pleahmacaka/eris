<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import ActivityPanel from "$lib/components/activity/ActivityPanel.svelte"
import GearCard from "$lib/components/gear/GearCard.svelte"
import Topology from "$lib/components/infra/Topology.svelte"
import LocaleSwitch from "$lib/components/locale/LocaleSwitch.svelte"
import StackList from "$lib/components/stack/StackList.svelte"
import SectionHeading from "$lib/components/ui/SectionHeading.svelte"
import { gear } from "$lib/data/gear"
import { OPERATOR } from "$lib/data/nodes"
import { groups } from "$lib/data/stack"
import { reveal } from "$lib/motion/reveal"
import { scramble } from "$lib/motion/scramble"
import * as m from "$lib/paraglide/messages"
import { localizeHref } from "$lib/paraglide/runtime"
import { CONTACT_EMAIL, SITE_NAME } from "$lib/site"

let { data } = $props()

const CHANNELS = [
  { label: "GitHub", icon: "simple-icons:github", href: OPERATOR.href },
  {
    label: "npm",
    icon: "simple-icons:npm",
    href: "https://www.npmjs.com/~pleahmacaka",
  },
  {
    label: "Tokscale",
    icon: "lucide:activity",
    href: "https://tokscale.ai/u/pleahmacaka",
  },
]
</script>

<main class="relative isolate min-h-dvh">
  <div class="grid-lines absolute inset-0 -z-10 opacity-60"></div>

  <nav
    class={[
      "mx-auto flex max-w-6xl items-center justify-between gap-4",
      "px-5 pt-8 text-xs sm:px-8",
    ]}
  >
    <a
      class={[
        "flex items-center gap-2 font-semibold text-base-content/70",
        "transition hover:text-base-content",
      ]}
      href={localizeHref("/")}
    >
      <img class="h-4 w-auto" src="/logo.svg" width="132" height="160" alt="" />
      {SITE_NAME}
    </a>

    <LocaleSwitch />
  </nav>

  <div
    class={[
      "mx-auto flex max-w-6xl flex-col gap-24",
      "px-5 pt-24 pb-24 sm:gap-32 sm:px-8 sm:pb-32",
    ]}
  >
    <div class="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <header class="flex flex-col gap-6">
        <p class="flex items-center gap-3 text-primary text-sm">
          <span class="size-1.5 bg-primary"></span>
          <span use:scramble={{ delay: 120 }}>{OPERATOR.profile}</span>
        </p>

        <h1
          class={[
            "font-extrabold leading-none tracking-tight",
            "text-5xl sm:text-7xl",
          ]}
          use:scramble={{ duration: 900 }}
        >
          {OPERATOR.handle}
        </h1>

        <nav
          class={[
            "flex flex-wrap items-center gap-x-6 gap-y-3",
            "text-base-content/70 text-sm",
          ]}
        >
          {#each CHANNELS as channel (channel.label)}
            <a
              class="flex items-center gap-2 transition hover:text-primary"
              href={channel.href}
              rel="me noreferrer"
              target="_blank"
            >
              <Icon class="size-4 shrink-0" icon={channel.icon} />
              {channel.label}
            </a>
          {/each}

          <a
            class="flex items-center gap-2 transition hover:text-primary"
            href="mailto:{CONTACT_EMAIL}"
          >
            <Icon class="size-4 shrink-0" icon="lucide:mail" />
            {CONTACT_EMAIL}
          </a>
        </nav>
      </header>

      <section class="flex flex-col gap-3" data-reveal use:reveal={1}>
        <h2 class="text-base-content/60 text-xs">{m.section_infra()}</h2>

        <Topology />
      </section>
    </div>

    <section class="flex flex-col gap-8">
      <SectionHeading index={1} title={m.section_activity()} />

      {#await data.activity}
        <div class="hud min-h-80 bg-neutral/60"></div>
      {:then activity}
        {#if activity.length > 0}
          <div data-reveal use:reveal={1}>
            <ActivityPanel windows={activity} />
          </div>
        {/if}
      {/await}
    </section>

    <section class="flex flex-col gap-8">
      <SectionHeading index={2} title={m.section_stack()} />

      <div data-reveal use:reveal={1}>
        <StackList {groups} />
      </div>
    </section>

    <section class="flex flex-col gap-8">
      <SectionHeading index={3} title={m.section_gear()} />

      <div class="grid gap-4 sm:grid-cols-3">
        {#each gear as group, i (group.label())}
          <div data-reveal use:reveal={i}>
            <GearCard {group} index={i + 1} />
          </div>
        {/each}
      </div>
    </section>
  </div>
</main>
