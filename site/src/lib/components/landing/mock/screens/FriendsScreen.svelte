<script lang="ts">
import Icon from "@iconify/svelte"
import type { MockCopy } from "#lib/server/mock.js"
import { useMockDemo } from "#lib/store/mockDemo.svelte.js"
import MockAvatar from "../MockAvatar.svelte"
import MockComposer from "../MockComposer.svelte"
import MockEmpty from "../MockEmpty.svelte"
import MockHeader from "../MockHeader.svelte"
import MockLabel from "../MockLabel.svelte"
import MockRail from "../MockRail.svelte"
import MockRow from "../MockRow.svelte"
import MockSidebar from "../MockSidebar.svelte"
import MockThread from "../MockThread.svelte"

let { t }: { t: MockCopy } = $props()

const demo = useMockDemo()

const ENTRY =
  "flex items-center justify-between gap-3 rounded-field px-2 py-1.5"

const TAB = "btn btn-ghost btn-xs pointer-events-none"

const MENU_ROW = 1

const pane = $derived(demo?.pane ?? "friends")

const peer = $derived(t.people.find(person => person.name === demo?.peer))
</script>

{#snippet entry(icon: string, label: string)}
  <span class={ENTRY}>
    <span class="min-w-0 truncate">{label}</span>
    <Icon {icon} class="size-3.5 shrink-0 text-base-content/70" />
  </span>
{/snippet}

<MockRail {t} home />

<MockSidebar {t} title={t.nav.home}>
  <MockRow
    icon="lucide:users"
    label={t.nav.friends}
    active={pane === "friends"}
    onclick={demo && (() => demo.openPane("friends"))}
  />
  <MockRow
    icon="lucide:house"
    label={t.nav.home}
    active={pane === "home"}
    onclick={demo && (() => demo.openPane("home"))}
  />

  <span class="btn btn-sm pointer-events-none my-2 px-2 text-xs">
    <Icon icon="lucide:message-square-plus" class="size-4 shrink-0" />
    <span class="min-w-0 truncate">{t.nav.start}</span>
  </span>

  <MockLabel label={t.nav.direct} />

  {#each t.people as person (person.name)}
    <MockRow
      label={person.name}
      active={pane === "dm" && peer?.name === person.name}
      onclick={demo && (() => demo.openDm(person.name))}
    >
      <MockAvatar name={person.name} size="xs" tone="primary" />
    </MockRow>
  {/each}
</MockSidebar>

<div
  class={[
    "relative min-w-0 flex-1 flex-col",
    demo?.listOpen ? "hidden @2xl:flex" : "flex",
  ]}
>
  {#if pane === "dm" && peer}
    <MockHeader avatar={peer.name} title={peer.name} back={t.back} />
    <MockThread messages={peer.thread} empty={t.empty} />
    <MockComposer placeholder={peer.placeholder} />
  {:else if pane === "home"}
    <MockHeader icon="lucide:house" title={t.nav.home} back={t.back} />
    <MockEmpty
      icon="lucide:messages-square"
      title={t.home.title}
      hint={t.home.hint}
    />
  {:else}
    <MockHeader icon="lucide:users" title={t.nav.friends} back={t.back}>
      <span class="h-4 shrink-0 border-s border-base-content/15"></span>

      <span class="flex shrink-0 items-center gap-1">
        <span class={TAB}>{t.friends.tabs.online}</span>
        <span class={[TAB, "btn-active"]}>{t.friends.tabs.all}</span>
        <span class={[TAB, "hidden @lg:inline-flex"]}>
          {t.friends.tabs.pending}
        </span>
        <span
          class="btn btn-success btn-xs pointer-events-none hidden @lg:inline-flex"
        >
          {t.friends.add}
        </span>
      </span>
    </MockHeader>

    <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 @2xl:px-4">
      <span
        class={[
          "flex h-8 shrink-0 items-center gap-2 rounded-field border px-2.5",
          "border-base-content/25 bg-base-200 text-base-content/60",
        ]}
      >
        <Icon icon="lucide:search" class="size-3.5 shrink-0" />
        <span class="min-w-0 truncate text-xs">{t.friends.search}</span>
      </span>

      <p class="flex gap-2 font-semibold text-2xs text-base-content/60">
        <span class="min-w-0 truncate">{t.friends.tabs.all}</span>
        <span class="tabular-nums">{t.friends.count}</span>
      </p>

      <ul class="flex flex-col">
        {#each t.people as person, index (person.name)}
          <li
            class={[
              "flex items-center gap-3 border-t px-1 py-2",
              "border-base-content/10",
              !demo && index === MENU_ROW && "bg-base-content/5",
              person.presence === "offline" && "opacity-60",
            ]}
          >
            <MockAvatar name={person.name} size="sm" presence={person.presence} />

            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-medium">{person.name}</span>
              <span class="truncate text-2xs text-base-content/70">
                {person.status}
              </span>
            </span>

            {#if demo}
              <button
                type="button"
                class="btn btn-circle btn-sm"
                aria-label={person.placeholder}
                title={person.placeholder}
                onclick={() => demo.openDm(person.name)}
              >
                <Icon icon="lucide:message-circle" class="size-4" />
              </button>
            {:else}
              <span
                class="btn btn-circle btn-sm pointer-events-none hidden @2xl:inline-flex"
              >
                <Icon icon="lucide:message-circle" class="size-4" />
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    {#if !demo}
      <div
        class={[
          "absolute end-3 top-48 flex w-max max-w-60 min-w-44 flex-col",
          "rounded-box border p-1",
          "border-base-content/20 bg-base-200 text-xs shadow-xl",
          "@2xl:start-1/3 @2xl:end-auto",
        ]}
      >
        {@render entry("lucide:check-check", t.friends.menu.read)}
        {@render entry("lucide:user-plus", t.friends.menu.invite)}
        {@render entry("lucide:link", t.friends.menu.link)}

        <span class="mx-2 my-1 border-t border-base-content/15"></span>

        <span class={[ENTRY, "text-error"]}>
          <span class="min-w-0 truncate">{t.friends.menu.leave}</span>
          <Icon icon="lucide:log-out" class="size-3.5 shrink-0 rtl:-scale-x-100" />
        </span>
      </div>
    {/if}
  {/if}
</div>
