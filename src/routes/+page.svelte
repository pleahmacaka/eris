<script lang="ts">
import Icon from "@iconify/svelte"
import ActivityPanel from "$lib/components/activity/ActivityPanel.svelte"
import CareerList from "$lib/components/career/CareerList.svelte"
import GearCard from "$lib/components/gear/GearCard.svelte"
import LocaleSwitch from "$lib/components/locale/LocaleSwitch.svelte"
import ProjectCard from "$lib/components/projects/ProjectCard.svelte"
import StackList from "$lib/components/stack/StackList.svelte"
import { posts } from "$lib/data/career"
import { gear } from "$lib/data/gear"
import { projects } from "$lib/data/projects"
import { groups } from "$lib/data/stack"
import { reveal } from "$lib/motion/reveal"
import * as m from "$lib/paraglide/messages"

let { data } = $props()

const PROFILES = [
  {
    label: "GitHub",
    icon: "simple-icons:github",
    href: "https://github.com/pleahmacaka",
  },
  {
    label: "npm",
    icon: "simple-icons:npm",
    href: "https://www.npmjs.com/~pleahmacaka",
  },
  {
    label: "LinkedIn",
    icon: "simple-icons:linkedin",
    href: "https://www.linkedin.com/in/pleahmacaka/",
  },
  {
    label: "Tokscale",
    icon: "lucide:activity",
    href: "https://tokscale.ai/u/pleahmacaka",
  },
]

const SECTION_HEADING = "font-semibold text-base-content/70 text-sm"
</script>

<div
  class={[
    "mx-auto flex min-h-dvh max-w-5xl flex-col",
    "gap-12 px-5 py-10 sm:gap-16 sm:px-8 sm:py-14",
  ]}
>
  <header class="flex flex-col gap-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1
        class={[
          "flex items-center gap-3 sm:gap-4",
          "font-extrabold text-5xl tracking-tight sm:text-6xl",
        ]}
      >
        <img class="h-14 w-auto sm:h-16" src="/logo.svg" width="132" height="160" alt="" />
        ArixLab
      </h1>

      <LocaleSwitch />
    </div>

    <p class="max-w-prose text-base-content/75 leading-relaxed">
      {m.tagline()}
    </p>

    <div class="flex flex-col gap-1">
      <p class="font-medium text-lg">
        {m.person_name()}
      </p>
      <p class="max-w-prose text-base-content/75">
        {m.person_headline()}
      </p>
      <p class="text-base-content/70 text-sm">
        {m.person_location()}
      </p>
    </div>

    <nav
      class="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium text-sm"
    >
      {#each PROFILES as profile (profile.label)}
        <a
          class="link link-hover flex items-center gap-2"
          href={profile.href}
          rel="me noreferrer"
          target="_blank"
        >
          <Icon class="size-4 shrink-0 self-center" icon={profile.icon} />
          {profile.label}
        </a>
      {/each}

      <span class="flex items-center gap-1">
        <a
          class="link link-hover flex items-center gap-2"
          href="mailto:pmc@arixlab.com"
        >
          <Icon class="size-4 shrink-0 self-center" icon="lucide:mail" />
          pmc@arixlab.com
        </a>

        <div class="dropdown dropdown-end">
          <div
            class="cursor-pointer p-0.5 text-base-content/70"
            tabindex="0"
            role="button"
            aria-label={m.email_more()}
          >
            <Icon class="size-3.5" icon="lucide:chevron-down" />
          </div>

          <ul
            class={[
              "dropdown-content menu z-10 mt-1 w-max rounded-box p-1",
              "border border-base-300 bg-base-100 font-normal shadow-sm",
            ]}
          >
            <li>
              <a href="mailto:pleahmacaka@gmail.com">
                fallback: pleahmacaka@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </span>
    </nav>
  </header>

  <main class="flex flex-col gap-12 sm:gap-16">
  <section class="flex flex-col gap-5">
    <h2 class={SECTION_HEADING}>{m.section_career()}</h2>

    <CareerList {posts} />
  </section>

  <section class="flex flex-col gap-5">
    <h2 class={SECTION_HEADING} data-reveal use:reveal>
      {m.section_projects()}
    </h2>

    <div class="grid gap-4 sm:grid-cols-2">
      {#each projects as project, i (project.name)}
        <div data-reveal use:reveal={i}>
          <ProjectCard {project} />
        </div>
      {/each}
    </div>
  </section>

  <section class="flex flex-col gap-5">
    <h2 class={SECTION_HEADING} data-reveal use:reveal>{m.section_stack()}</h2>

    <div data-reveal use:reveal={1}>
      <StackList {groups} />
    </div>
  </section>

  <section class="flex flex-col gap-5">
    <h2 class={SECTION_HEADING} data-reveal use:reveal>
      {m.section_activity()}
    </h2>

    {#await data.activity}
      <div class="min-h-80 rounded-box bg-neutral/5"></div>
    {:then activity}
      {#if activity.length > 0}
        <div data-reveal use:reveal={1}>
          <ActivityPanel windows={activity} />
        </div>
      {/if}
    {/await}
  </section>

  <section class="flex flex-col gap-5">
    <h2 class={SECTION_HEADING} data-reveal use:reveal>{m.section_gear()}</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each gear as group, i (group.label())}
        <div data-reveal use:reveal={i}>
          <GearCard {group} />
        </div>
      {/each}
    </div>
  </section>

  </main>

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
