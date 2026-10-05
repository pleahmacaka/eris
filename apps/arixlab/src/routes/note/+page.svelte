<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import LocaleSwitch from "$lib/components/locale/LocaleSwitch.svelte"
import ErisLink from "$lib/components/note/ErisLink.svelte"
import Phone from "$lib/components/note/Phone.svelte"
import Shot from "$lib/components/note/Shot.svelte"
import SectionHeading from "$lib/components/ui/SectionHeading.svelte"
import {
  chipsOf,
  extras,
  heroShot,
  NOTE_RELEASES,
  NOTE_SOURCE,
  showcase,
} from "$lib/data/note"
import { reveal } from "$lib/motion/reveal"
import { scramble } from "$lib/motion/scramble"
import * as m from "$lib/paraglide/messages"
import { getLocale, localizeHref } from "$lib/paraglide/runtime"
import type { Download } from "$lib/server/note"
import { SITE_NAME } from "$lib/site"

let { data } = $props()

const PLATFORMS = {
  windows: { name: "Windows", icon: "lucide:monitor" },
  android: { name: "Android", icon: "lucide:smartphone" },
}

const KINDS: Record<Download["kind"], () => string> = {
  installer: m.note_installer,
  msi: m.note_msi,
  apk: m.note_apk,
}

// Korean wraps at spaces; Japanese and Chinese have none, so they keep the default
const KO_WRAP = "[&:lang(ko)]:break-keep"

const pad = (n: number) => String(n).padStart(2, "0")

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const day = (iso: string) =>
  new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(
    new Date(iso),
  )
</script>

<main class="relative isolate min-h-dvh overflow-x-clip">
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
      "px-5 pt-20 pb-24 sm:gap-32 sm:px-8 sm:pt-24 sm:pb-32",
    ]}
  >
    <div class="flex flex-col gap-14 sm:gap-16">
      <header class="flex flex-col gap-6">
        <p class="flex items-center gap-3 text-primary text-sm">
          <span class="size-1.5 bg-primary"></span>
          <span use:scramble={{ delay: 120 }}>/note</span>
        </p>

        <h1
          class={[
            "font-extrabold leading-none tracking-tight",
            "text-5xl sm:text-7xl",
          ]}
          use:scramble={{ duration: 900 }}
        >
          ArixLab Note
        </h1>

        <p class={["max-w-2xl text-base-content/70 text-lg sm:text-xl", KO_WRAP]}>
          {m.note_tagline()}
        </p>

        <nav
          class={[
            "flex flex-wrap items-center gap-x-6 gap-y-3",
            "text-base-content/70 text-sm",
          ]}
        >
          <a
            class={[
              "flex items-center gap-2 bg-primary px-4 py-2 font-semibold",
              "text-primary-content transition hover:bg-primary/85",
            ]}
            href="#download"
          >
            <Icon class="size-4 shrink-0" icon="lucide:download" />
            {m.note_download()}
          </a>

          <a
            class="flex items-center gap-2 transition hover:text-primary"
            href={NOTE_SOURCE}
            rel="noreferrer"
            target="_blank"
          >
            <Icon class="size-4 shrink-0" icon="simple-icons:github" />
            {m.note_source()}
          </a>

          <a
            class="flex items-center gap-2 transition hover:text-primary"
            href={NOTE_RELEASES}
            rel="noreferrer"
            target="_blank"
          >
            <Icon class="size-4 shrink-0" icon="lucide:arrow-up-right" />
            {m.note_releases()}
          </a>
        </nav>
      </header>

      <div class="relative flex flex-col gap-5">
        <div
          class={[
            "pointer-events-none absolute inset-x-[8%] top-1/4 bottom-1/4 -z-10",
            "bg-primary/20 blur-3xl",
          ]}
          aria-hidden="true"
        ></div>

        <Shot shot={heroShot} alt={m.note_shot_editor()} eager />

        <ul class="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
          {#each chipsOf(m.note_hero_chips) as chip (chip)}
            <li class="flex items-center gap-2 text-base-content/60">
              <span class="size-1 bg-primary"></span>
              {chip}
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <section class="flex flex-col gap-12 sm:gap-16">
      <SectionHeading index={1} title={m.section_features()} />

      <div class="flex flex-col gap-24 sm:gap-32">
        {#each showcase as item, i (item.id)}
          {@const visual = item.visual}

          <article
            class="grid items-center gap-8 lg:grid-cols-12 lg:gap-14"
            data-reveal
            use:reveal
          >
            <div
              class={[
                "flex flex-col gap-4 lg:col-span-5",
                i % 2 === 1 && "lg:order-last",
              ]}
            >
              <span class="text-primary text-xs tabular-nums">
                {pad(i + 1)} / {pad(showcase.length)}
              </span>
              <h3 class="font-bold text-2xl tracking-tight sm:text-3xl">
                {item.title()}
              </h3>
              <p class={["text-base-content/70 leading-relaxed", KO_WRAP]}>
                {item.body()}
              </p>
              <ul class="flex flex-wrap gap-2">
                {#each chipsOf(item.chips) as chip (chip)}
                  <li
                    class="border border-base-300 px-2.5 py-1 text-base-content/70 text-xs"
                  >
                    {chip}
                  </li>
                {/each}
              </ul>
            </div>

            <div class="lg:col-span-7">
              {#if visual.kind === "shot"}
                <Shot shot={visual.shot} alt={item.title()} />
              {:else if visual.kind === "stack"}
                <div class="relative pr-10 pb-20 sm:pr-20 sm:pb-28">
                  <Shot shot={visual.back} alt={item.title()} />
                  <Shot
                    class="absolute right-0 bottom-0 w-1/2 shadow-2xl shadow-black/70"
                    shot={visual.front}
                    alt=""
                  />
                </div>
              {:else if visual.kind === "phones"}
                <div class="flex justify-center gap-4 pb-10 sm:gap-8">
                  <Phone
                    class="w-36 sm:w-52"
                    shot={visual.shots[0]}
                    alt={item.title()}
                  />
                  <Phone
                    class="w-36 translate-y-10 sm:w-52"
                    shot={visual.shots[1]}
                    alt=""
                  />
                </div>
              {:else}
                <ErisLink />
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="flex flex-col gap-8">
      <SectionHeading index={2} title={m.section_more()} />

      <div class="grid gap-px border border-base-300 bg-base-300 sm:grid-cols-2 lg:grid-cols-3">
        {#each extras as extra, i (extra.icon)}
          <div
            class="group flex gap-4 bg-base-200 p-5 transition hover:bg-base-100 sm:p-6"
            data-reveal
            use:reveal={i % 3}
          >
            <span
              class={[
                "flex size-9 shrink-0 items-center justify-center border",
                "border-base-300 text-primary transition",
                "group-hover:border-primary/60",
              ]}
            >
              <Icon class="size-4" icon={extra.icon} />
            </span>
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="font-semibold text-sm">{extra.title()}</h3>
              <p class={["text-base-content/60 text-sm leading-relaxed", KO_WRAP]}>
                {extra.body()}
              </p>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <section id="download" class="flex scroll-mt-8 flex-col gap-8">
      <SectionHeading index={3} title={m.note_download()} />

      {#await data.release}
        <div class="hud min-h-32 bg-neutral/60"></div>
      {:then release}
        {#if release && release.downloads.length > 0}
          <div class="flex flex-col gap-4" data-reveal use:reveal={1}>
            <p class="text-base-content/60 text-xs tabular-nums">
              <a class="transition hover:text-primary" href={release.url}>
                {m.note_version({ version: release.version })}
              </a>
              {#if release.published}
                <span> · {day(release.published)}</span>
              {/if}
            </p>

            <ul class="grid gap-2 sm:grid-cols-3">
              {#each release.downloads as download, i (download.url)}
                {@const platform = PLATFORMS[download.platform]}

                <li>
                  <a
                    class={[
                      "hud group flex items-center gap-4 bg-base-100/50",
                      "px-5 py-4 transition hover:hud-lit",
                    ]}
                    href={download.url}
                  >
                    <span class="text-primary text-xs tabular-nums">
                      {pad(i + 1)}
                    </span>
                    <Icon
                      class="size-4 shrink-0 text-base-content/60"
                      icon={platform.icon}
                    />
                    <span class="flex min-w-0 flex-col">
                      <span class="font-semibold">{platform.name}</span>
                      <span class="truncate text-base-content/60 text-xs">
                        {KINDS[download.kind]()} · {megabytes(download.size)}
                      </span>
                    </span>
                    <Icon
                      class={[
                        "ml-auto size-4 shrink-0 text-base-content/50",
                        "transition group-hover:text-primary",
                      ]}
                      icon="lucide:download"
                    />
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {:else}
          <p
            class={["text-base-content/70 text-sm", KO_WRAP]}
            data-reveal
            use:reveal={1}
          >
            {m.note_unreleased()}
            <a class="link link-hover text-primary" href={NOTE_SOURCE}>
              {m.note_source()}
            </a>
          </p>
        {/if}
      {/await}
    </section>
  </div>
</main>
