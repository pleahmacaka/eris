<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import ItemIcon from "../items/ItemIcon.svelte"
  import ZoomImage from "./ZoomImage.svelte"
  import { formatBytes, formatDate } from "../../format"
  import type { Item } from "../../items"
  import { type FileKind, kindOf } from "../../filetypes"
  import { isVirtual, parentOf } from "../../locations"
  import { allowPreview, assetUrl, previewText } from "../../native"
  import { confirmPrivate } from "../../store/privacy.svelte"

  type Kind = Exclude<FileKind, "model">

  type Shown = {
    key: string
    kind: Kind | null
    url: string
    text: string
  }

  let { item }: { item: Item | null } = $props()

  let shown = $state<Shown | null>(null)

  const previewKind = (target: Item): Kind | null => {
    const kind = kindOf(target.name)

    return kind === "model" ? "text" : kind
  }

  const load = async (target: Item): Promise<Shown> => {
    const kind = previewKind(target)
    const blank = { key: target.key, kind: null, url: "", text: "" }

    if (!kind) {
      return blank
    }

    if (!(await confirmPrivate(target.path, parentOf(target.path) ?? ""))) {
      return blank
    }

    if (kind === "text") {
      const text = await previewText(target.path).catch(() => "")

      return text ? { ...blank, kind, text } : blank
    }

    await allowPreview(target.path)

    return { ...blank, kind, url: assetUrl(target.path) }
  }

  $effect(() => {
    const target = item

    if (!target || target.dir || target.packed || isVirtual(target.path)) {
      shown = null

      return
    }

    let live = true

    load(target)
      .catch(() => ({ key: target.key, kind: null, url: "", text: "" }))
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

<aside
  class={[
    "flex w-80 shrink-0 flex-col gap-3 overflow-hidden",
    "border-l border-base-content/10 p-3",
  ]}
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
      {#if current?.kind === "image"}
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
