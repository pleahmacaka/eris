<script lang="ts">
  import { Segmented } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { customCleanup, delayInstaller } from "../../store/cleanup.svelte"

  let dialog = $state<HTMLDialogElement>()
  let amount = $state(3)
  let unit = $state<"hours" | "days">("hours")

  const hours = $derived(unit === "days" ? amount * 24 : amount)
  const valid = $derived(Number.isFinite(amount) && amount > 0)

  $effect(() => {
    if (customCleanup.item && dialog && !dialog.open) {
      dialog.showModal()
    }
  })

  const close = () => {
    customCleanup.item = null
    dialog?.close()
  }

  const apply = (e: SubmitEvent) => {
    e.preventDefault()

    if (customCleanup.item && valid) {
      delayInstaller(customCleanup.item, hours)
    }

    close()
  }
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (customCleanup.item = null)}>
  <form class="modal-box eris-card flex max-w-sm flex-col gap-3" onsubmit={apply}>
    <h3 class="text-base font-semibold">{$t("explorer.decor.customTitle")}</h3>

    <div class="flex items-center gap-2">
      <input
        type="number"
        min="1"
        step="1"
        class="input input-sm w-24 tabular-nums"
        aria-label={$t("explorer.decor.customLabel")}
        bind:value={amount}
      />

      <Segmented
        bind:value={unit}
        label={$t("explorer.decor.customLabel")}
        options={[
          { value: "hours", label: $t("explorer.decor.hoursUnit") },
          { value: "days", label: $t("explorer.decor.daysUnit") },
        ]}
      />
    </div>

    <div class="modal-action mt-0">
      <button type="button" class="btn btn-ghost btn-sm" onclick={close}>
        {$t("common.cancel")}
      </button>

      <button type="submit" class="btn btn-primary btn-sm" disabled={!valid}>
        {$t("explorer.decor.apply")}
      </button>
    </div>
  </form>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>
