<script lang="ts">
  let {
    open = $bindable(false),
    title,
    body,
    action = "Confirm",
    onconfirm,
  }: {
    open?: boolean
    title: string
    body: string
    action?: string
    onconfirm: () => void
  } = $props()

  let dialog = $state<HTMLDialogElement>()

  $effect(() => {
    if (!dialog) {
      return
    }

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })

  const confirm = () => {
    open = false
    onconfirm()
  }
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
  <div
    class="modal-box max-w-sm border border-base-content/10 bg-base-100/90 backdrop-blur-xl"
  >
    <h3 class="text-base font-semibold">{title}</h3>

    <p class="mt-2 text-sm text-base-content/70">{body}</p>

    <div class="modal-action">
      <button type="button" class="btn btn-ghost btn-sm" onclick={() => (open = false)}>
        Cancel
      </button>

      <button type="button" class="btn btn-error btn-sm" onclick={confirm}>
        {action}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">close</button>
  </form>
</dialog>
