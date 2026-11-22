<script lang="ts">
import Icon from "@iconify/svelte"
import type { Snippet } from "svelte"
import type { ClassValue } from "svelte/elements"

type Props = {
  open: boolean
  label: string
  close: string
  class?: ClassValue
  header?: Snippet
  children: Snippet
}

let {
  open = $bindable(),
  label,
  close,
  class: className,
  header,
  children,
}: Props = $props()

let dialog = $state<HTMLDialogElement>()
let opened = $state(false)

$effect(() => {
  if (open) {
    opened = true
    dialog?.showModal()
  } else {
    dialog?.close()
  }
})
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-label={label}
  onclose={() => (open = false)}
>
  <div class={["modal-box flex flex-col gap-3 p-3 sm:p-4", className]}>
    <div class="flex shrink-0 items-start gap-2">
      <div class="min-w-0 flex-1">
        {@render header?.()}
      </div>

      <form method="dialog" class="shrink-0">
        <button
          class="btn btn-ghost btn-sm btn-square"
          aria-label={close}
          title={close}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </form>
    </div>

    {#if opened}
      {@render children()}
    {/if}
  </div>

  <form method="dialog" class="modal-backdrop">
    <button tabindex="-1" aria-hidden="true">{close}</button>
  </form>
</dialog>
