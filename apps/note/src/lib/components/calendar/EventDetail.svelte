<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    atMinutes,
    dateKey,
    dateTimeKey,
    parseLocal,
    startOfDay,
  } from "$lib/data/calendar"
  import { events as eventStore, newId } from "$lib/data/store"
  import type { CalendarEvent, Recurrence } from "$lib/data/types"
  import { citeLink, segments } from "$lib/markdown/cite"
  import { layout } from "$lib/workspace/layout.svelte"
  import { openPath } from "$lib/workspace/navigate"
  import { colorMeta, eventColors, type EventColor, toColor } from "./colors"
  import { clock, eventSpan, longDay } from "./format"

  const {
    event,
    day,
    editing,
    setEditing,
    close,
  }: {
    event: CalendarEvent | null
    day: Date
    editing: boolean
    setEditing: (value: boolean) => void
    close: () => void
  } = $props()

  const cite = () => {
    layout.citeInto = path => {
      const gap = notes === "" || notes.endsWith("\n") ? "" : "\n"

      notes = `${notes}${gap}${citeLink(path)}`
    }
    layout.palette = "cite-note"
  }

  const RECURRENCES: { id: Recurrence; label: string }[] = [
    { id: "none", label: "반복 없음" },
    { id: "daily", label: "매일" },
    { id: "weekdays", label: "평일" },
    { id: "weekly", label: "매주" },
    { id: "monthly", label: "매월" },
    { id: "yearly", label: "매년" },
  ]

  const minutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number)

    return hour * 60 + minute
  }

  let title = $state("")
  let notes = $state("")
  let allDay = $state(false)
  let startTime = $state("10:00")
  let endTime = $state("11:00")
  let color = $state<EventColor>("primary")
  let recurrence = $state<Recurrence>("none")

  const load = () => {
    title = event?.title ?? ""
    notes = event?.notes ?? ""
    allDay = event?.allDay ?? false
    startTime = event && !event.allDay ? clock(event.start) : "10:00"
    endTime = event && !event.allDay ? clock(event.end) : "11:00"
    color = toColor(event?.color ?? null)
    recurrence = event?.recurrence ?? "none"
  }

  $effect(() => {
    if (editing) {
      load()
    }
  })

  const save = async () => {
    if (!title.trim()) {
      return
    }

    const base = startOfDay(parseLocal(event?.start ?? dateKey(day)))
    const stamp = Date.now()
    const next: CalendarEvent = {
      id: event?.id ?? newId(),
      title: title.trim(),
      notes,
      allDay,
      start: allDay ? dateKey(base) : dateTimeKey(atMinutes(base, minutes(startTime))),
      end: allDay ? dateKey(base) : dateTimeKey(atMinutes(base, minutes(endTime))),
      color,
      reminderMinutes: event?.reminderMinutes ?? null,
      recurrence,
      createdAt: event?.createdAt ?? stamp,
      updatedAt: stamp,
    }

    await eventStore.put(next)
    setEditing(false)
    close()
  }

  const drop = async () => {
    if (event) {
      await eventStore.remove(event.id)
    }

    close()
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-center gap-2 border-b border-base-content/10 px-4 py-3">
    <button
      class="btn btn-sm btn-ghost btn-square -ml-2 @4xl:hidden"
      aria-label="뒤로"
      onclick={close}
    >
      <Icon icon="lucide:arrow-left" class="size-4" />
    </button>
    <Icon icon="lucide:calendar-check" class="size-3.5 opacity-60 @max-4xl:hidden" />
    <span class="flex-1 text-xs text-base-content/55">
      {editing ? "일정 편집" : "일정 상세"}
    </span>

    {#if event && !editing}
      <button
        class="btn btn-sm btn-ghost btn-square @4xl:btn-xs"
        aria-label="편집"
        onclick={() => setEditing(true)}
      >
        <Icon icon="lucide:pencil" class="size-4 @4xl:size-3" />
      </button>

      <button
        class="btn btn-sm btn-ghost btn-square @4xl:btn-xs text-error"
        aria-label="삭제"
        onclick={drop}
      >
        <Icon icon="lucide:trash-2" class="size-4 @4xl:size-3" />
      </button>
    {/if}

    <button
      class="btn btn-sm btn-ghost btn-square @max-4xl:hidden @4xl:btn-xs"
      aria-label="닫기"
      onclick={close}
    >
      <Icon icon="lucide:x" class="size-4 @4xl:size-3" />
    </button>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    {#if editing}
      <label class="block">
        <span class="text-xs font-medium text-base-content/55">
          제목
        </span>
        <input
          class={[
            "mt-1 w-full border-0 border-b border-base-content/10 bg-transparent",
            "px-0 py-1.5 text-lg font-semibold outline-none",
            "focus:border-primary",
          ]}
          placeholder="새 일정 제목"
          bind:value={title}
        />
      </label>

      <label class="mt-4 flex cursor-pointer items-center justify-between">
        <span class="text-sm">종일</span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          bind:checked={allDay}
        />
      </label>

      {#if !allDay}
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-medium text-base-content/55">
              시작
            </span>
            <input
              type="time"
              class="input input-sm mt-1 w-full"
              bind:value={startTime}
            />
          </label>

          <label class="block">
            <span class="text-xs font-medium text-base-content/55">
              종료
            </span>
            <input
              type="time"
              class="input input-sm mt-1 w-full"
              bind:value={endTime}
            />
          </label>
        </div>
      {/if}

      <div class="mt-3">
        <span class="text-xs font-medium text-base-content/55">
          색상
        </span>
        <div class="mt-1.5 flex gap-2">
          {#each eventColors as option (option)}
            <button
              type="button"
              class={[
                "size-7 cursor-pointer ring-2 ring-offset-2",
                "ring-offset-base-100",
                colorMeta[option].chip,
                color === option ? "ring-base-content" : "ring-transparent",
              ]}
              aria-label={colorMeta[option].label}
              onclick={() => (color = option)}
            ></button>
          {/each}
        </div>
      </div>

      <label class="mt-4 block">
        <span class="text-xs font-medium text-base-content/55">
          반복
        </span>
        <select class="select select-sm mt-1 w-full" bind:value={recurrence}>
          {#each RECURRENCES as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="mt-4 block">
        <span class="text-xs font-medium text-base-content/55">
          메모
        </span>
        <textarea
          class="textarea mt-1 w-full text-sm"
          rows="5"
          placeholder="메모, 안건, 링크"
          bind:value={notes}
        ></textarea>
      </label>

      <button class="btn btn-ghost btn-xs mt-1" onclick={cite}>
        <Icon icon="lucide:quote" class="size-3.5" />
        노트 인용
      </button>

      <div class="mt-5 flex gap-2">
        <button class="btn btn-sm btn-ghost flex-1" onclick={close}>취소</button>

        <button
          class="btn btn-sm btn-primary flex-1"
          disabled={!title.trim()}
          onclick={save}
        >
          저장
        </button>
      </div>
    {:else if event}
      {@const meta = colorMeta[toColor(event.color)]}
      <div class="flex items-center gap-2">
        <span class={["size-2.5", meta.chip]}></span>
        <span class="text-xs text-base-content/55">
          {meta.label}
        </span>
      </div>

      <h2 class="mt-2 text-xl font-semibold leading-tight">{event.title}</h2>

      <div class="mt-3 grid grid-cols-4 gap-y-2 text-sm">
        <div class="text-base-content/55">날짜</div>
        <div class="col-span-3">{longDay(parseLocal(event.start))}</div>

        <div class="text-base-content/55">시간</div>
        <div class="tabular col-span-3">{eventSpan(event)}</div>

        <div class="text-base-content/55">반복</div>
        <div class="col-span-3">
          {RECURRENCES.find(r => r.id === event.recurrence)?.label ?? "반복 없음"}
        </div>
      </div>

      <div class="mt-4 border-t border-base-content/10 pt-4">
        <div class="text-xs text-base-content/55">
          메모
        </div>
        <p
          class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-base-content/85"
        >
          {#if !event.notes}
            메모 없음
          {/if}
          {#each segments(event.notes) as part, i (i)}
            {#if "path" in part}
              <button
                class={[
                  "mx-0.5 inline-flex cursor-pointer items-center gap-1 border",
                  "border-primary/30 bg-primary/10 px-1.5 align-baseline text-xs",
                  "text-primary hover:bg-primary/20",
                ]}
                onclick={() => openPath(part.path)}
              >
                <Icon icon="lucide:file-text" class="size-3" />
                {part.label}
              </button>
            {:else}
              {part.text}
            {/if}
          {/each}
        </p>
      </div>
    {/if}
  </div>
</div>
