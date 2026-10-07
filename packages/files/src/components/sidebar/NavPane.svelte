<script lang="ts">
  import { t } from "svelte-i18n"
  import {
    HOME,
    RECYCLE_BIN,
    SHARED,
    sameLocation,
    THIS_PC,
  } from "../../locations"
  import type { Drive, KnownId } from "../../native"
  import { rootRem, Splitter, track } from "@eris/ui"
  import type { Explorer } from "../../store/explorer.svelte"
  import { openPlaceMenu, type Place } from "../../store/menus"
  import { driveName, places } from "../../store/places.svelte"
  import { prefs, type SidebarSection } from "../../store/prefs.svelte"
  import {
    movePin,
    orderedPins,
    pathShown,
    sectionShown,
  } from "../../store/sidebar"
  import NavEntry from "./NavEntry.svelte"

  type Entry = Place & {
    label: string
    nested?: boolean
    icon?: string
    drive?: Drive
    pin?: number
  }

  let { explorer }: { explorer: Explorer } = $props()

  const ORDER: KnownId[] = [
    "desktop",
    "downloads",
    "documents",
    "pictures",
    "music",
    "videos",
  ]

  const GROUPS: SidebarSection[][] = [
    ["home", "pinned"],
    ["folders"],
    ["drives", "network", "linux"],
    ["shared", "recycleBin"],
  ]

  const NAV_MIN = 10
  const NAV_MAX = 32
  const DRAG_SLOP = 6

  let pane = $state<HTMLElement>()
  let dragging = $state<{ from: number; to: number } | null>(null)
  let dragged = false

  const location = $derived(explorer.tab.location)

  const folders = $derived(
    ORDER.flatMap(id => {
      const known = places.known.find(entry => entry.id === id)

      return known ? [{ id, path: known.path }] : []
    }),
  )

  const pins = $derived(
    orderedPins(
      places.pinned.filter(
        pin => !folders.some(folder => sameLocation(folder.path, pin.path)),
      ),
    ),
  )

  const entries: Record<SidebarSection, Entry[]> = $derived({
    home: [
      {
        label: $t("explorer.places.home"),
        location: HOME,
        section: "home",
        hide: "section",
      },
    ],
    pinned: pins.map((pin, index) => ({
      label: pin.name,
      location: pin.path,
      section: "pinned",
      hide: null,
      nested: sectionShown("home"),
      pin: index,
    })),
    folders: folders
      .filter(folder => pathShown(folder.path))
      .map(folder => ({
        label: $t(`explorer.places.${folder.id}`),
        location: folder.path,
        section: "folders",
        hide: "path",
      })),
    drives: [
      {
        label: $t("explorer.places.thisPc"),
        location: THIS_PC,
        section: "drives",
        hide: "section",
      },
      ...places.drives
        .filter(drive => pathShown(drive.path))
        .map(drive => ({
          label: driveName(drive, $t),
          location: drive.path,
          section: "drives" as const,
          hide: "path" as const,
          nested: true,
          drive,
        })),
    ],
    network: places.network
      .filter(place => pathShown(place.path))
      .map(place => ({
        label: place.name,
        location: place.path,
        section: "network",
        hide: "path",
        nested: sectionShown("drives"),
      })),
    linux: places.linux
      .filter(distro => pathShown(distro.path))
      .map(distro => ({
        label: distro.name,
        location: distro.path,
        section: "linux",
        hide: "path",
        nested: sectionShown("drives"),
      })),
    shared: [
      {
        label: $t("explorer.places.shared"),
        location: SHARED,
        section: "shared",
        hide: "section",
        icon: "lucide:share-2",
      },
    ],
    recycleBin: [
      {
        label: $t("explorer.places.recycleBin"),
        location: RECYCLE_BIN,
        section: "recycleBin",
        hide: "section",
      },
    ],
  })

  const groups = $derived(
    GROUPS.map(ids =>
      ids.filter(sectionShown).flatMap(id => entries[id]),
    ).filter(group => group.length),
  )

  const reorder = (from: number) => (e: PointerEvent) => {
    if (e.button !== 0) {
      return
    }

    const middles = [
      ...(pane?.querySelectorAll<HTMLElement>("[data-pin]") ?? []),
    ].map(row => {
      const box = row.getBoundingClientRect()

      return box.top + box.height / 2
    })

    track(
      e,
      next => {
        if (!dragging && Math.abs(next.clientY - e.clientY) < DRAG_SLOP) {
          return
        }

        const to = middles.findIndex(middle => next.clientY < middle)

        dragging = { from, to: to < 0 ? middles.length : to }
      },
      () => {
        if (dragging) {
          movePin(
            pins.map(pin => pin.path),
            dragging.from,
            dragging.to,
          )
          dragged = true
          setTimeout(() => (dragged = false))
        }

        dragging = null
      },
    )
  }

  const open = (target: string) => {
    if (!dragged) {
      explorer.go(target)
    }
  }

  const fit = () => {
    if (!pane) {
      return
    }

    const current = pane.style.width

    pane.style.width = "max-content"

    const natural = pane.getBoundingClientRect().width / rootRem()

    pane.style.width = current
    prefs.navWidth = Math.min(
      NAV_MAX,
      Math.max(NAV_MIN, Math.ceil(natural * 4) / 4 + 0.5),
    )
  }

  const resize = {
    axis: "x",
    min: NAV_MIN,
    max: NAV_MAX,
    get: () => prefs.navWidth,
    set: (width: number) => (prefs.navWidth = width),
  } as const
</script>

{#snippet marker(bottom: boolean)}
  <div
    class={[
      "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-primary",
      bottom ? "-bottom-0.5" : "-top-0.5",
    ]}
  ></div>
{/snippet}

<aside
  bind:this={pane}
  aria-label={$t("explorer.nav.navigation")}
  class="flex shrink-0 flex-col gap-0.5 overflow-y-auto px-2 py-2"
  style:width="{prefs.navWidth}rem"
  oncontextmenu={e => openPlaceMenu(explorer, e, null)}
>
  {#each groups as group, index (index)}
    {#if index > 0}
      <div class="mx-2 my-1.5 border-t border-base-content/10"></div>
    {/if}

    {#each group as entry (`${entry.section}:${entry.location}`)}
      <div class="relative" data-pin={entry.pin === undefined ? undefined : ""}>
        {#if dragging && entry.pin === dragging.to}
          {@render marker(false)}
        {/if}

        <NavEntry
          label={entry.label}
          location={entry.location}
          icon={entry.icon}
          nested={entry.nested}
          active={sameLocation(entry.location, location)}
          onopen={() => open(entry.location)}
          onaux={() => explorer.newTab(entry.location)}
          onmenu={e => openPlaceMenu(explorer, e, entry)}
          onpress={entry.pin === undefined ? undefined : reorder(entry.pin)}
        >
          {#if entry.drive && entry.drive.total > 0}
            <progress
              class={[
                "progress ml-6 h-1 w-auto",
                entry.drive.free / entry.drive.total < 0.1
                  ? "progress-error"
                  : "progress-primary",
              ]}
              value={entry.drive.total - entry.drive.free}
              max={entry.drive.total}
            ></progress>
          {/if}
        </NavEntry>

        {#if dragging?.to === pins.length && entry.pin === pins.length - 1}
          {@render marker(true)}
        {/if}
      </div>
    {/each}
  {/each}
</aside>

<Splitter {resize} onreset={fit} />
