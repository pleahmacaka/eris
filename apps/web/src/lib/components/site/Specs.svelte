<script lang="ts">
  import { scramble } from "$lib/ascii/scramble"
  import Eyebrow from "$lib/components/ui/Eyebrow.svelte"
  import type { Copy } from "$lib/copy/en"

  let { t }: { t: Copy } = $props()

  const languages = [
    { code: "en", label: "English" },
    { code: "ko", label: "한국어" },
    { code: "ja", label: "日本語" },
    { code: "zh", label: "中文" },
  ]
</script>

<section
  aria-labelledby="specs-title"
  class="border-y border-base-content/10 bg-base-200/60"
>
  <div class="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-24">
    <h2 id="specs-title">
      <Eyebrow>{t.specs.title}</Eyebrow>
    </h2>

    <dl class="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
      {#each t.specs.items as spec, i (spec.label)}
        <div class="flex flex-col-reverse justify-end gap-3">
          <dt class="flex flex-col gap-1 text-base-content/60">
            {spec.label}

            {#if i === t.specs.items.length - 1}
              <span class="flex flex-wrap gap-x-3 text-base-content/80 text-sm">
                {#each languages as language (language.code)}
                  <span lang={language.code}>{language.label}</span>
                {/each}
              </span>
            {/if}
          </dt>

          <dd
            class={[
              "grid font-black tracking-tighter tabular-nums",
              "text-6xl sm:text-7xl",
            ]}
          >
            <span class="invisible col-start-1 row-start-1">{spec.value}</span>
            <span class="col-start-1 row-start-1" {@attach scramble}
              >{spec.value}</span
            >
          </dd>
        </div>
      {/each}
    </dl>

    <p class="max-w-2xl text-base-content/70 text-lg">{t.specs.note}</p>
  </div>
</section>
