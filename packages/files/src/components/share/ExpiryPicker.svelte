<script lang="ts">
  import { t } from "svelte-i18n"
  import {
    EXPIRY_PRESETS,
    type ExpiryPreset,
    expiryFrom,
    toLocalInput,
  } from "./expiry"

  type Choice = ExpiryPreset | "custom"

  let {
    choice = $bindable("day"),
    value = $bindable(null),
    onchange,
  }: {
    choice?: Choice
    value?: number | null
    onchange?: (value: number | null) => void
  } = $props()

  const pick = (next: Choice) => {
    choice = next
    value = next === "custom" ? (value ?? expiryFrom("day")) : expiryFrom(next)
    onchange?.(value)
  }

  const pickDate = (text: string) => {
    const at = new Date(text).getTime()

    if (Number.isNaN(at)) {
      return
    }

    value = at
    onchange?.(value)
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  <select
    class="select select-sm w-32"
    aria-label={$t("share.expiry")}
    value={choice}
    onchange={e => pick(e.currentTarget.value as Choice)}
  >
    {#each EXPIRY_PRESETS as preset (preset)}
      <option value={preset}>{$t(`share.expiryOptions.${preset}`)}</option>
    {/each}

    <option value="custom">{$t("share.expiryOptions.custom")}</option>
  </select>

  {#if choice === "custom"}
    <input
      type="datetime-local"
      class="input input-sm w-auto tabular-nums"
      aria-label={$t("share.expiryOptions.custom")}
      min={toLocalInput(Date.now())}
      value={value ? toLocalInput(value) : ""}
      onchange={e => pickDate(e.currentTarget.value)}
    />
  {/if}
</div>
