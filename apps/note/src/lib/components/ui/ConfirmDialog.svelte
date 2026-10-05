<script lang="ts">
  let {
    open = $bindable(false),
    title,
    body = "",
    action,
    onconfirm,
  }: {
    open?: boolean
    title: string
    body?: string
    action: string
    onconfirm: () => void
  } = $props()

  let dialog: HTMLDialogElement

  $effect(() => {
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })
</script>

<dialog bind:this={dialog} class="modal" onclose={() => (open = false)}>
  <div class="modal-box max-w-sm border border-base-content/10">
    <h3 class="font-semibold">{title}</h3>

    {#if body}
      <p class="mt-2 text-sm text-base-content/60">{body}</p>
    {/if}

    <div class="modal-action">
      <button class="btn btn-ghost btn-sm" onclick={() => (open = false)}>
        취소
      </button>
      <button
        class="btn btn-error btn-sm"
        onclick={() => {
          open = false
          onconfirm()
        }}
      >
        {action}
      </button>
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button aria-label="닫기">닫기</button>
  </form>
</dialog>
