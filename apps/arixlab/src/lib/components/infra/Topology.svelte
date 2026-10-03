<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import { nodes, OPERATOR } from "$lib/data/nodes"
import { scramble } from "$lib/motion/scramble"

const STAGGER = 0.3

const flow = (step: number) => `animation-delay: ${step * STAGGER}s`

const boot = (step: number) => ({ delay: 300 + step * 110, duration: 520 })
</script>

<div class="hud flex flex-col gap-6 bg-base-200/40 p-6 sm:p-7">
  <p class="flex items-center gap-3 font-semibold">
    <span class="size-2 bg-primary"></span>
    <span use:scramble={{ delay: 180 }}>{OPERATOR.handle}</span>
  </p>

  <ul class="flex flex-col gap-5 pl-7">
    {#each nodes as node, i (node.role())}
      <li class="group/node relative">
        <span
          class={[
            "trace absolute top-0 -bottom-5 -left-6",
            "group-first/node:-top-8",
            "group-last/node:bottom-auto group-last/node:h-3",
          ]}
          style={flow(i)}
        ></span>
        <span
          class={[
            "absolute top-3 -left-6 w-4 border-base-content/20 border-t",
            "transition group-hover/node:border-primary",
          ]}
        ></span>

        <div
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5"
        >
          <span
            class="font-medium transition group-hover/node:text-primary"
            use:scramble={boot(i)}
          >
            {node.role()}
          </span>
          {#if node.detail}
            <span
              class="text-base-content/75 text-sm"
              use:scramble={boot(i + 1)}
            >
              {node.detail}
            </span>
          {/if}
        </div>

        {#if node.spec}
          <p class="mt-1 text-base-content/60 text-xs">{node.spec}</p>
        {/if}

        {#if node.endpoints}
          <ul class="mt-3 flex flex-col gap-2 pl-6">
            {#each node.endpoints as endpoint, j (endpoint.host)}
              <li class="group/leaf relative text-sm">
                <span
                  class={[
                    "trace absolute top-0 -bottom-2 -left-5",
                    "group-first/leaf:-top-3",
                    "group-last/leaf:bottom-auto group-last/leaf:h-2.5",
                  ]}
                  style={flow(nodes.length + j)}
                ></span>
                <span
                  class={[
                    "absolute top-2.5 -left-5 w-3.5 border-base-content/20 border-t",
                    "transition group-hover/leaf:border-primary",
                  ]}
                ></span>

                {#if endpoint.href}
                  <a
                    class="flex w-fit items-center gap-1.5 transition hover:text-primary"
                    href={endpoint.href}
                  >
                    {endpoint.host}
                    <Icon
                      class="size-3.5 text-base-content/50"
                      icon="lucide:arrow-up-right"
                    />
                  </a>
                {:else}
                  <span class="text-base-content/75">{endpoint.host}</span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
</div>
