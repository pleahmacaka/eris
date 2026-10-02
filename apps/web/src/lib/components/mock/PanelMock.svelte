<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Copy } from "$lib/copy/en"
  import MockStage from "./MockStage.svelte"

  let { t }: { t: Copy } = $props()

  const TODAY = 2
  const LAST_DAY = 31
  const FIRST_WEEKDAY = 4
  const EVENT_DAYS = [2, 5, 6, 8, 15, 22, 29]

  const days = Array.from({ length: 35 }, (_, i) => i - FIRST_WEEKDAY + 1)

  const card = "rounded-box border border-base-content/10 bg-base-100 p-4 shadow-2xl"
</script>

<MockStage>
  <div class="m-auto grid w-full max-w-2xl gap-3 sm:grid-cols-12">
    <div class={[card, "flex flex-col sm:col-span-7"]}>
      <div class="mb-3 flex items-center justify-between">
        <span class="font-semibold text-sm">{t.mock.panel.month}</span>

        <span class="flex gap-2 text-base-content/50">
          <Icon icon="lucide:chevron-left" class="size-4" />
          <Icon icon="lucide:chevron-right" class="size-4" />
          <Icon icon="lucide:maximize-2" class="size-3.5" />
        </span>
      </div>

      <div class="grid grid-cols-7 gap-y-1 text-center text-xs tabular-nums">
        {#each t.mock.panel.weekdays as weekday, i (i)}
          <span class="pb-1 text-base-content/45">{weekday}</span>
        {/each}

        {#each days as day (day)}
          <span
            class={[
              "relative mx-auto grid size-8 place-items-center rounded-lg",
              day === TODAY && "bg-primary font-semibold text-primary-content",
              (day < 1 || day > LAST_DAY) && "invisible",
            ]}
          >
            {day}

            {#if EVENT_DAYS.includes(day)}
              <span
                class={[
                  "absolute bottom-1 size-1 rounded-full",
                  day === TODAY ? "bg-primary-content" : "bg-primary",
                ]}
              ></span>
            {/if}
          </span>
        {/each}
      </div>

      <div class="mt-3 flex flex-col gap-1.5 border-t border-base-content/10 pt-3">
        <span class="font-medium text-base-content/55 text-xs">
          {t.mock.panel.day}
        </span>

        {#each t.mock.panel.agenda as event (event.title)}
          <span class="flex items-center gap-2 text-sm">
            <span class="size-2 shrink-0 rounded-full bg-primary"></span>
            <span class="text-base-content/60 text-xs tabular-nums">
              {event.time}
            </span>
            <span class="truncate font-medium">{event.title}</span>
          </span>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-3 sm:col-span-5">
      <div class={[card, "flex flex-col gap-2.5 text-sm"]}>
        {#each t.mock.panel.todos as todo, i (todo)}
          <div class="flex items-center gap-2">
            <span
              class={[
                "grid size-4 shrink-0 place-items-center rounded border",
                i === 0
                  ? "border-primary bg-primary text-primary-content"
                  : "border-base-content/30",
              ]}
            >
              {#if i === 0}
                <Icon icon="lucide:check" class="size-3" />
              {/if}
            </span>

            <span
              class={["truncate", i === 0 && "text-base-content/50 line-through"]}
            >
              {todo}
            </span>
          </div>
        {/each}

        <span
          class={[
            "rounded-field border border-base-content/15 px-3 py-1.5",
            "text-base-content/40 text-xs",
          ]}
        >
          {t.mock.panel.quickAdd}
        </span>
      </div>

      <div class={[card, "flex grow flex-col gap-2"]}>
        <span class="flex items-center gap-2 font-semibold text-sm">
          <Icon icon="lucide:sticky-note" class="size-4 text-accent" />
          {t.mock.panel.note}
        </span>
        <div class="h-1 w-full rounded-full bg-base-content/15"></div>
        <div class="h-1 w-5/6 rounded-full bg-base-content/15"></div>
        <div class="h-1 w-2/3 rounded-full bg-base-content/15"></div>
      </div>
    </div>
  </div>
</MockStage>
