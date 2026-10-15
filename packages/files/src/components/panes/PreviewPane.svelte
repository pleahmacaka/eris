<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { untrack } from "svelte"
  import { Splitter } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { docKind } from "@eris/doc-preview"
  import ItemIcon from "../items/ItemIcon.svelte"
  import DocumentPeek from "./DocumentPeek.svelte"
  import FolderPane from "./FolderPane.svelte"
  import FolderPeek from "./FolderPeek.svelte"
  import HexView from "./HexView.svelte"
  import TensorPeek from "./TensorPeek.svelte"
  import ZoomImage from "./ZoomImage.svelte"
  import { formatBytes, formatDate } from "../../format"
  import { fromArchive, fromListing, type Item, packedEntry } from "../../items"
  import { type FileKind, kindOf } from "../../filetypes"
  import { isVirtual, parentOf } from "../../locations"
  import {
    allowPreview,
    assetUrl,
    extractEntry,
    inspectTensors,
    listDir,
    previewText,
    type Tensors,
  } from "../../native"
  import { archiveListing, isArchive } from "../../store/archive.svelte"
  import { prefs } from "../../store/prefs.svelte"
  import { confirmPrivate } from "../../store/privacy.svelte"
  import type { Tab } from "../../store/tab.svelte"

  type FileView = Exclude<FileKind, "model"> | "document"

  type Content =
    | { kind: null }
    | { kind: "folder" | "archive"; children: Item[] }
    | { kind: "text"; text: string }
    | { kind: "hex" }
    | { kind: "tensors"; tensors: Tensors }
    | { kind: Exclude<FileView, "text" | "tensors">; url: string }

  type Shown = Content & { key: string; source?: string }

  const NOTHING: Content = { kind: null }

  let { item, tab }: { item: Item | null; tab: Tab } = $props()

  let shown = $state.raw<Shown | null>(null)
  let hexView = $state(false)

  const version = $derived(
    item ? `${item.key}\0${item.modified}\0${item.size}` : null,
  )

  const previewKind = (target: Item): FileView | null => {
    if (docKind(target.name)) {
      return "document"
    }

    const kind = kindOf(target.name)

    return kind === "model" ? "text" : kind
  }

  const children = async (target: Item) => {
    if (target.packed) {
      const listing = await archiveListing(target.packed, false)

      return fromArchive(target.path, target.packed, packedEntry(target), listing)
    }

    if (target.dir) {
      return fromListing(await listDir(target.path))
    }

    return fromArchive(target.path, target.path, "", await archiveListing(target.path, false))
  }

  const load = async (target: Item): Promise<Content & { source?: string }> => {
    if (!(await confirmPrivate(target.path, parentOf(target.path) ?? ""))) {
      return NOTHING
    }

    if (target.dir || (!target.packed && isArchive(target.name))) {
      return { kind: target.dir ? "folder" : "archive", children: await children(target) }
    }

    const kind = previewKind(target)
    const path = target.packed ? await extractEntry(target.packed, packedEntry(target)) : target.path
    const hex = { kind: "hex" as const, source: path }

    if (!kind) {
      return target.size > 0 ? hex : NOTHING
    }

    if (kind === "text") {
      const text = await previewText(path).catch(() => "")

      return text ? { kind, text, source: path } : target.size > 0 ? hex : NOTHING
    }

    if (kind === "tensors") {
      const tensors = await inspectTensors(path).catch(() => null)

      return tensors ? { kind, tensors, source: path } : hex
    }

    await allowPreview(path)

    return { kind, url: assetUrl(path), source: path }
  }

  $effect(() => {
    const target = version ? untrack(() => item) : null

    hexView = false

    if (!target || isVirtual(target.path)) {
      shown = null

      return
    }

    let live = true

    load(target)
      .catch(() => NOTHING)
      .then(content => {
        if (live) {
          shown = { ...content, key: target.key }
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
    <FolderPane {tab} />
  {:else}
    <div
      class={[
        "relative flex min-h-0 grow items-center justify-center overflow-hidden",
        "rounded-box bg-base-content/5",
      ]}
    >
      {#if current?.source && current.kind !== "hex"}
        <button
          type="button"
          class={[
            "btn btn-square btn-xs absolute top-2 right-2 z-10",
            hexView ? "btn-primary" : "btn-ghost bg-base-100/70",
          ]}
          aria-label={$t("explorer.hex.toggle")}
          title={$t("explorer.hex.toggle")}
          aria-pressed={hexView}
          onclick={() => (hexView = !hexView)}
        >
          <Icon icon="lucide:binary" class="size-3.5" />
        </button>
      {/if}

      {#if current?.source && (current.kind === "hex" || hexView)}
        {#key current.source}
          <HexView path={current.source} size={item.size} />
        {/key}
      {:else if current?.kind === "folder" || current?.kind === "archive"}
        <FolderPeek
          items={current.children}
          label={$t(current.kind === "folder" ? "explorer.peek.items" : "explorer.peek.archive", {
            values: { count: current.children.length },
          })}
        />
      {:else if current?.kind === "tensors"}
        <TensorPeek tensors={current.tensors} />
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
