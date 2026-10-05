<script lang="ts">
import Icon from "@iconify/svelte/dist/OfflineIcon.svelte"
import * as m from "$lib/paraglide/messages"

// sample data matching the screenshots: an Eris event that cites a note
const EVENTS = [
  { time: "14:00", title: "디자인 리뷰", bar: "bg-primary", note: "10월 5일" },
  { time: "19:00", title: "필라멘트 건조", bar: "bg-warning", note: null },
]

const LINES = ["w-3/4", "w-full", "w-5/6", "w-2/3"]
</script>

<div
  class={[
    "hud relative grid items-center gap-4 bg-base-200/60 p-5",
    "sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:p-8",
  ]}
>
  <div class="border border-base-300 bg-base-100 p-4 shadow-xl shadow-black/40">
    <p class="flex items-center justify-between text-base-content/50 text-xs">
      <span>
        <span class="text-primary">//</span>
        {m.note_eris_panel()}
      </span>
      <span class="tabular-nums">10.05</span>
    </p>

    <ul class="mt-4 flex flex-col gap-3">
      {#each EVENTS as event (event.title)}
        <li class={["flex gap-3", !event.note && "opacity-50"]}>
          <span class={["w-0.5 shrink-0", event.bar]}></span>
          <div class="flex min-w-0 flex-col gap-1">
            <span class="text-base-content/55 text-xs tabular-nums">
              {event.time}
            </span>
            <span class="font-semibold text-sm">{event.title}</span>
            {#if event.note}
              <span
                class={[
                  "flex w-fit items-center gap-1.5 border border-primary/50",
                  "bg-primary/10 px-2 py-0.5 text-primary text-xs",
                ]}
              >
                <Icon class="size-3.5" icon="lucide:file-text" />
                {event.note}
              </span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <div
    class="flex items-center justify-center gap-2 text-primary sm:flex-col"
    aria-hidden="true"
  >
    <span class="h-6 w-px bg-primary/40 sm:h-px sm:w-10"></span>
    <Icon class="size-4 rotate-90 sm:rotate-0" icon="lucide:arrow-right" />
    <span class="h-6 w-px bg-primary/40 sm:h-px sm:w-10"></span>
  </div>

  <div class="border border-base-300 bg-base-100 shadow-xl shadow-black/40">
    <div
      class={[
        "flex items-center gap-2 border-base-300 border-b px-3 py-2",
        "text-base-content/60 text-xs",
      ]}
    >
      <span class="size-1.5 bg-primary"></span>
      note
      <span class="ml-2 border-primary border-t px-2 text-base-content">
        10월 5일
      </span>
    </div>

    <div class="flex flex-col gap-2 p-4">
      <span class="font-bold text-sm">10월 5일 디자인 리뷰</span>
      {#each LINES as width, i (i)}
        <span class={["h-1.5 bg-base-content/15", width]}></span>
      {/each}
      <span class="mt-2 flex items-center gap-1.5 text-success text-xs">
        <Icon class="size-3.5" icon="lucide:check" />
        {m.note_eris_opens()}
      </span>
    </div>
  </div>
</div>
