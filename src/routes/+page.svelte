<script lang="ts">
import Icon from "@iconify/svelte"
import Reading from "$lib/components/activity/Reading.svelte"
import StackCard from "$lib/components/stack/StackCard.svelte"
import { capabilities } from "$lib/data/stack"

let { data } = $props()
</script>

<div
  class={[
    "mx-auto flex min-h-dvh max-w-5xl flex-col",
    "gap-10 px-5 py-12 sm:gap-14 sm:px-8 sm:py-20",
  ]}
>
  <header class="flex flex-col gap-5">
    <h1 class="font-extrabold text-5xl tracking-tight sm:text-6xl">ArixLab</h1>

    <p class="max-w-prose text-base-content/75 leading-relaxed">
      A Matrix Lab. Root domain for what I build: desktop apps, TypeScript
      packages on npm, and vision models compiled to run on the device in front
      of you.
    </p>

    <a
      class="link link-hover flex w-fit items-center gap-2 font-medium text-sm"
      href="https://github.com/pleahmacaka"
      rel="me noreferrer"
      target="_blank"
    >
      <Icon class="size-4 shrink-0 self-center" icon="simple-icons:github" />
      pleahmacaka
    </a>
  </header>

  {#if data.githubFeed || data.tokscaleFeed}
    <section
      class={[
        "rounded-box bg-neutral text-neutral-content",
        "flex flex-col gap-6 p-5 sm:gap-7 sm:p-7",
      ]}
      aria-label="Activity"
    >
      {#if data.githubFeed}
        <Reading
          feed={data.githubFeed}
          icon="simple-icons:github"
          source="GitHub"
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
        />
      {/if}
    </section>
  {/if}

  <section class="grid gap-4 sm:grid-cols-2" aria-label="What I work with">
    {#each capabilities as capability (capability.title)}
      <StackCard {capability} />
    {/each}
  </section>

  <footer
    class={[
      "mt-auto flex flex-wrap items-center justify-between gap-4",
      "border-base-300 border-t pt-6 text-base-content/70 text-sm",
    ]}
  >
    <p>arixlab.com</p>

    <nav class="flex items-center gap-4">
      <a
        class="link link-hover"
        href="https://github.com/pleahmacaka"
        rel="noreferrer"
        target="_blank">GitHub</a
      >
      <a
        class="link link-hover"
        href="https://tokscale.ai/u/pleahmacaka"
        rel="noreferrer"
        target="_blank">Tokscale</a
      >
    </nav>
  </footer>
</div>
