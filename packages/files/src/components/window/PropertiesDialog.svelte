<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import { formatBytes } from "../../format"
  import { parentOf } from "../../locations"
  import {
    cancelSearch,
    randomToken,
    type Stat,
    statItems,
    type Tally,
    tallyDirs,
  } from "../../native"
  import { places } from "../../store/places.svelte"
  import { closeProperties, propertiesView } from "../../store/properties.svelte"
  import ItemIcon from "../items/ItemIcon.svelte"

  const ATTRIBUTES = [
    ["readonly", 0x1],
    ["hidden", 0x2],
    ["system", 0x4],
    ["compressed", 0x800],
    ["encrypted", 0x4000],
  ] as const

  let dialog = $state<HTMLDialogElement>()
  let stats = $state<Stat[]>([])
  let tally = $state<Tally | null>(null)
  let measuring = $state(false)

  const paths = $derived(propertiesView.paths)
  const single = $derived(stats.length === 1 ? stats[0] : null)
  const drive = $derived(
    single ? places.drives.find(entry => entry.path === single.path) : undefined,
  )
  const locale = $derived(currentLocale())

  const dates = $derived(
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "medium" }),
  )

  const count = $derived(new Intl.NumberFormat(locale))

  const kinds = $derived(new Set(stats.map(stat => stat.kind)))

  const parent = $derived.by(() => {
    const found = new Set(paths.map(parentOf))

    return found.size === 1 ? [...found][0] : null
  })

  const bytes = $derived(
    stats.reduce((sum, stat) => sum + stat.size, 0) + (tally?.bytes ?? 0),
  )

  const flags = $derived(
    single
      ? ATTRIBUTES.filter(
          ([key, bit]) =>
            single.attrs & bit && !(single.dir && key === "readonly"),
        ).map(([key]) => key)
      : [],
  )

  const sized = (value: number) =>
    $t("explorer.properties.bytes", {
      values: {
        size: formatBytes(value, locale),
        bytes: count.format(value),
      },
    })

  $effect(() => {
    const requested = paths

    if (requested.length === 0) {
      dialog?.close()

      return
    }

    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    let live = true
    const token = randomToken()

    stats = []
    tally = null
    measuring = false

    statItems(requested)
      .then(found => {
        if (!live) {
          return
        }

        stats = found

        const folders = found
          .filter(stat => stat.dir && !places.drives.some(entry => entry.path === stat.path))
          .map(stat => stat.path)

        if (folders.length > 0) {
          measuring = true
          tallyDirs(folders, token)
            .then(result => {
              if (live) {
                tally = result
              }
            })
            .catch(() => undefined)
            .finally(() => {
              if (live) {
                measuring = false
              }
            })
        }
      })
      .catch(() => undefined)

    return () => {
      live = false
      cancelSearch(token).catch(() => undefined)
    }
  })
</script>

{#snippet row(label: string, value: string)}
  <dt class="text-base-content/55">{label}</dt>
  <dd class="min-w-0 break-all select-text">{value}</dd>
{/snippet}

<dialog bind:this={dialog} class="modal" onclose={closeProperties}>
  <div class="modal-box eris-card flex max-w-md flex-col gap-4">
    <div class="flex items-center gap-3">
      <ItemIcon source={single?.path ?? paths[0] ?? ""} rem={2.5} />

      <div class="flex min-w-0 flex-col">
        <h3 class="truncate text-base font-semibold">
          {single
            ? single.name
            : $t("explorer.properties.items", {
                values: { count: count.format(paths.length) },
              })}
        </h3>

        <span class="truncate text-sm text-base-content/55">
          {kinds.size === 1 ? [...kinds][0] : $t("explorer.properties.mixed")}
        </span>
      </div>
    </div>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm tabular-nums">
      {#if parent && !drive}
        {@render row($t("explorer.properties.location"), parent)}
      {/if}

      {#if drive}
        {@render row($t("explorer.properties.used"), sized(drive.total - drive.free))}
        {@render row($t("explorer.properties.free"), sized(drive.free))}
        {@render row($t("explorer.properties.total"), sized(drive.total))}
      {:else}
        {@render row(
          $t("explorer.properties.size"),
          measuring ? $t("explorer.properties.measuring") : sized(bytes),
        )}

        {#if tally}
          {@render row(
            $t("explorer.properties.contents"),
            $t("explorer.properties.contentsValue", {
              values: {
                files: count.format(tally.files),
                folders: count.format(tally.folders),
              },
            }),
          )}
        {/if}
      {/if}

      {#if single}
        {#if single.created}
          {@render row($t("explorer.properties.created"), dates.format(single.created))}
        {/if}

        {#if single.modified}
          {@render row($t("explorer.properties.modified"), dates.format(single.modified))}
        {/if}

        {#if single.accessed}
          {@render row($t("explorer.properties.accessed"), dates.format(single.accessed))}
        {/if}
      {/if}

      {#if flags.length > 0 || single?.link}
        <dt class="text-base-content/55">{$t("explorer.properties.attributes")}</dt>

        <dd class="flex flex-wrap gap-1">
          {#each flags as flag (flag)}
            <span class="badge badge-soft badge-sm">
              {$t(`explorer.properties.${flag}`)}
            </span>
          {/each}

          {#if single?.link}
            <span class="badge badge-soft badge-sm">
              {$t("explorer.properties.link")}
            </span>
          {/if}
        </dd>
      {/if}
    </dl>

    {#if drive}
      <progress
        class="progress progress-primary w-full"
        value={drive.total - drive.free}
        max={drive.total}
        aria-label={$t("explorer.properties.used")}
      ></progress>
    {/if}

    <div class="modal-action mt-0">
      <button type="button" class="btn btn-sm" onclick={() => dialog?.close()}>
        {$t("explorer.properties.close")}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>
