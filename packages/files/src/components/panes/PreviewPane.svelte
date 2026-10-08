<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { Splitter } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { docKind } from "@eris/doc-preview"
  import ItemIcon from "../items/ItemIcon.svelte"
  import DocumentPeek from "./DocumentPeek.svelte"
  import FolderPeek from "./FolderPeek.svelte"
  import ZoomImage from "./ZoomImage.svelte"
  import { formatBytes, formatDate } from "../../format"
  import { fromArchive, fromListing, type Item, packedEntry } from "../../items"
  import { type FileKind, kindOf } from "../../filetypes"
  import { isVirtual, parentOf } from "../../locations"
  import {
    allowPreview,
    assetUrl,
    extractEntry,
    listArchive,
    listDir,
    previewText,
  } from "../../native"
  import { isArchive } from "../../store/archive.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import { confirmPrivate } from "../../store/privacy.svelte"

  type Kind = Exclude<FileKind, "model"> | "document" | "folder" | "archive"

  type Shown = {
    key: string
    kind: Kind | null
    url: string
    text: string
    children: Item[]
  }

  let { item }: { item: Item | null } = $props()

  let shown = $state<Shown | null>(null)

  const previewKind = (target: Item): Kind | null => {
    if (docKind(target.name)) {
      return "document"
    }

    const kind = kindOf(target.name)

    return kind === "model" ? "text" : kind
  }

  const children = async (target: Item) => {
    if (target.packed) {
      const listing = await listArchive(target.packed)

      return fromArchive(target.path, target.packed, packedEntry(target), listing)
    }

    if (target.dir) {
      return fromListing(await listDir(target.path))
    }

    return fromArchive(target.path, target.path, "", await listArchive(target.path))
  }

  const load = async (target: Item): Promise<Shown> => {
    const blank = { key: target.key, kind: null, url: "", text: "", children: [] }

    if (!(await confirmPrivate(target.path, parentOf(target.path) ?? ""))) {
      return blank
    }

    if (target.dir || (!target.packed && isArchive(target.name))) {
      return { ...blank, kind: target.dir ? "folder" : "archive", children: await children(target) }
    }

    const kind = previewKind(target)

    if (!kind) {
      return blank
    }

    const path = target.packed ? await extractEntry(target.packed, packedEntry(target)) : target.path

    if (kind === "text") {
      const text = await previewText(path).catch(() => "")

      return text ? { ...blank, kind, text } : blank
    }

    await allowPreview(path)

    return { ...blank, kind, url: assetUrl(path) }
  }

  $effect(() => {
    const target = item

    if (!target || isVirtual(target.path)) {
      shown = null

      return
    }

    let live = true

    load(target)
      .catch(() => ({ key: target.key, kind: null, url: "", text: "", children: [] }))
      .then(next => {
        if (live) {
          shown = next
        }
      })

    return () => {
      live = false
    }
  })

  const current = $derived(
    shown && item && shown.key === item.key ? shown : null,
  )

  const facts = $derived(
    item
      ? [
          { label: $t("explorer.columns.kind"), value: item.kind },
          {
            label: $t("explorer.columns.size"),
            value: item.dir ? "" : formatBytes(item.size, currentLocale()),
          },
          {
            label: $t("explorer.columns.modified"),
            value: formatDate(item.modified, currentLocale()),
          },
        ].filter(fact => fact.value)
      : [],
  )
</script>

<Splitter
  resize={{
    axis: "x",
    invert: true,
    min: 14,
    max: 40,
    get: () => prefs.previewWidth,
    set: width => (prefs.previewWidth = width),
  }}
  onreset={() => (prefs.previewWidth = 20)}
/>

<aside
  class="flex shrink-0 flex-col gap-3 overflow-hidden p-3"
  style:width="{prefs.previewWidth}rem"
>
  {#if !item}
    <div
      class={[
        "flex grow items-center justify-center px-4 text-center text-sm",
        "text-base-content/50",
      ]}
    >
      {$t("explorer.states.selectToPreview")}
    </div>
  {:else}
    <div
      class={[
        "flex min-h-0 grow items-center justify-center overflow-hidden",
        "rounded-box bg-base-content/5",
      ]}
    >
      {#if current?.kind === "folder" || current?.kind === "archive"}
        <FolderPeek
          items={current.children}
          label={$t(current.kind === "folder" ? "explorer.peek.items" : "explorer.peek.archive", {
            values: { count: current.children.length },
          })}
        />
      {:else if current?.kind === "document"}
        <DocumentPeek url={current.url} name={item.name} />
      {:else if current?.kind === "image"}
        {#key current.url}
          <ZoomImage src={current.url} alt={item.name} />
        {/key}
      {:else if current?.kind === "video"}
        <video src={current.url} controls class="max-h-full max-w-full">
          <track kind="captions" />
        </video>
      {:else if current?.kind === "audio"}
        <audio src={current.url} controls class="w-full"></audio>
      {:else if current?.kind === "pdf"}
        <iframe src={current.url} title={item.name} class="size-full border-0"
        ></iframe>
      {:else if current?.kind === "text"}
        <pre
          class={[
            "size-full overflow-auto p-3 text-xs leading-relaxed",
            "break-words whitespace-pre-wrap",
          ]}>{current.text}</pre>
      {:else}
        <div class="flex flex-col items-center gap-2 text-sm text-base-content/50">
          <ItemIcon source={item} rem={6} thumbnail class="size-24" />

          {#if current}
            {$t("explorer.states.noPreview")}
          {/if}
        </div>
      {/if}
    </div>

    <div class="flex shrink-0 flex-col gap-1 text-xs">
      <span class="truncate text-sm font-medium" title={item.name}>
        {item.name}
      </span>

      {#each facts as fact (fact.label)}
        <div class="flex justify-between gap-3">
          <span class="shrink-0 text-base-content/50">{fact.label}</span>

          <span class="truncate tabular-nums">{fact.value}</span>
        </div>
      {/each}
    </div>
  {/if}
</aside>
