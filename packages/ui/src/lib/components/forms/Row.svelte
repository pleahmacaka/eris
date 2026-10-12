<script module lang="ts">
  import type { PinPath } from "@eris/settings"
  import { getContext, setContext } from "svelte"

  export type RowPins = {
    has: (path: PinPath) => boolean
    toggle: (path: PinPath) => void
  }

  const PINS = Symbol("row-pins")

  export const providePins = (pins: RowPins) => setContext(PINS, pins)
</script>

<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Snippet } from "svelte"
  import { t } from "svelte-i18n"

  export type RowTag = "experimental" | "partial"

  let {
    label,
    hint,
    value,
    tag,
    stacked = false,
    onreset,
    pin,
    children,
  }: {
    label: string
    hint?: string
    value?: string
    tag?: RowTag
    stacked?: boolean
    onreset?: () => void
    pin?: PinPath
    children?: Snippet
  } = $props()

  const pins = getContext<RowPins | undefined>(PINS)

  const pinned = $derived(!!pin && !!pins?.has(pin))
</script>

<div
  data-row={label}
  class={[
    "group/row flex gap-4 px-4 py-3",
    stacked ? "flex-col" : "items-center justify-between",
  ]}
>
  <div class="flex min-w-0 grow items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-1.5">
      <div class="flex min-w-0 flex-col">
        <span class="flex items-center gap-2 text-sm font-medium">
          {label}

          {#if tag}
            <span
              class={[
                "badge badge-soft badge-xs",
                tag === "experimental" ? "badge-warning" : "badge-info",
              ]}
            >
              {$t(`common.${tag}`)}
            </span>
          {/if}
        </span>

        {#if hint}
          <span class="text-xs text-base-content/60">{hint}</span>
        {/if}
      </div>

      {#if onreset}
        <button
          type="button"
          class="btn btn-ghost btn-circle btn-xs shrink-0 opacity-0 transition-opacity duration-100 group-hover/row:opacity-60 hover:opacity-100 focus-visible:opacity-100"
          aria-label={$t("common.reset")}
          title={$t("common.reset")}
          onclick={onreset}
        >
          <Icon icon="lucide:rotate-ccw" class="size-3.5" />
        </button>
      {/if}

      {#if pins && pin}
        <button
          type="button"
          class={[
            "btn btn-ghost btn-circle btn-xs shrink-0 transition-opacity duration-100",
            pinned
              ? "text-primary"
              : "opacity-0 group-hover/row:opacity-60 hover:opacity-100 focus-visible:opacity-100",
          ]}
          aria-pressed={pinned}
          aria-label={$t(pinned ? "common.syncSetting" : "common.pinSetting")}
          title={$t(pinned ? "common.syncSetting" : "common.pinSetting")}
          onclick={() => pins.toggle(pin)}
        >
          <Icon icon={pinned ? "lucide:user-round-check" : "lucide:user-round"} class="size-3.5" />
        </button>
      {/if}
    </div>

    {#if value !== undefined}
      <span class="text-xs text-base-content/70 tabular-nums">{value}</span>
    {/if}
  </div>

  {#if children}
    <div class={["shrink-0", stacked && "w-full"]}>
      {@render children()}
    </div>
  {/if}
</div>
