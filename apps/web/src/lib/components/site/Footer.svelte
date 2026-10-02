<script lang="ts">
  import AsciiLogo from "@eris/ui/AsciiLogo.svelte"
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import { ARIXLAB, MATRIX, REPO } from "$lib/links"

  let { t }: { t: Copy } = $props()

  const family = $derived([
    {
      name: "ArixLab",
      about: t.footer.products.arixlab,
      href: ARIXLAB,
      host: "arixlab.com",
    },
    {
      name: "ArixLab Matrix",
      about: t.footer.products.matrix,
      href: MATRIX,
      host: "matrix.arixlab.com",
    },
    {
      name: "Eris",
      about: t.footer.products.eris,
      href: null,
      host: t.footer.current,
    },
  ])
</script>

<footer class="border-t border-base-content/10">
  <div
    class={[
      "mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16",
      "lg:flex-row lg:items-start lg:justify-between",
    ]}
  >
    <div class="flex flex-col gap-4">
      <span class="flex items-center gap-3">
        <span aria-hidden="true">
          <AsciiLogo cols={20} class="w-20" />
        </span>
        <span class="font-black text-2xl tracking-tighter uppercase">Eris</span>
      </span>

      <p class="text-base-content/60 text-sm">{t.footer.note}</p>

      <a
        class="link link-hover flex w-fit items-center gap-2 text-sm"
        href={REPO}
      >
        <Icon icon="lucide:github" class="size-4" />
        {t.footer.source}
      </a>
    </div>

    <section
      aria-labelledby="family-title"
      class="flex w-full max-w-md flex-col gap-3"
    >
      <div
        class="flex items-center justify-between text-base-content/60 text-xs"
      >
        <h2 id="family-title">{t.footer.family}</h2>
        <span class="tabular-nums">
          {String(family.length).padStart(2, "0")}
        </span>
      </div>

      <ul class="flex flex-col gap-2">
        {#each family as item, i (item.name)}
          {@const number = String(i + 1).padStart(2, "0")}

          <li>
            {#if item.href}
              <a
                class={[
                  "group flex items-center gap-4 rounded-box border px-5 py-4",
                  "border-base-content/10 bg-base-100/50 transition",
                  "hover:border-primary/60",
                ]}
                href={item.href}
              >
                <span class="text-primary text-xs tabular-nums">{number}</span>

                <span class="flex min-w-0 flex-col">
                  <span class="font-semibold">{item.name}</span>
                  <span class="truncate text-base-content/60 text-xs">
                    {item.about}
                  </span>
                </span>

                <span
                  class="ml-auto hidden text-base-content/60 text-sm sm:block"
                >
                  {item.host}
                </span>

                <Icon
                  icon="lucide:arrow-up-right"
                  class={[
                    "size-4 shrink-0 text-base-content/50 transition",
                    "group-hover:text-primary",
                  ]}
                />
              </a>
            {:else}
              <div
                class={[
                  "flex items-center gap-4 rounded-box border px-5 py-4",
                  "border-primary/40 bg-base-100/50",
                ]}
                aria-current="page"
              >
                <span class="text-primary text-xs tabular-nums">{number}</span>

                <span class="flex min-w-0 flex-col">
                  <span class="font-semibold">{item.name}</span>
                  <span class="truncate text-base-content/60 text-xs">
                    {item.about}
                  </span>
                </span>

                <span class="ml-auto text-primary text-sm">{item.host}</span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  </div>
</footer>
