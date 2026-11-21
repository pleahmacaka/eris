<script lang="ts">
import Dialog from "#lib/components/ui/Dialog.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import { promptStore } from "#lib/store/prompt.svelte.js"

let note = $state("")
let busy = $state(false)
let error = $state<Message | null>(null)

const request = $derived(promptStore.confirming)

const close = () => {
  promptStore.confirming = null
  note = ""
  error = null
}

const confirm = async (event: SubmitEvent) => {
  event.preventDefault()

  if (!request || busy) {
    return
  }

  busy = true
  error = null

  try {
    await request.run(note.trim())
    close()
  } catch (cause) {
    error = actionError(errorCode(cause))
  } finally {
    busy = false
  }
}
</script>

<Dialog open={request !== null} title={request ? i18n.text(request.title) : ""} onclose={close}>
  <form id="confirm-form" class="flex flex-col gap-3" onsubmit={confirm}>
    {#if request}
      <p class="text-muted text-sm">{i18n.text(request.body)}</p>
    {/if}
    {#if request?.note}
      <fieldset class="fieldset gap-2" disabled={busy}>
        <label class="fieldset-label" for="confirm-note">{i18n.text(request.note)}</label>
        <input id="confirm-note" class="input w-full" autocomplete="off" bind:value={note} />
      </fieldset>
    {/if}
    <p class="min-h-5 text-error text-xs" role="alert">{error ? i18n.text(error) : ""}</p>
  </form>

  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={close}>{i18n.t("ui.cancel")}</button>
    <button type="submit" form="confirm-form" class="btn btn-error" disabled={busy}>
      {request ? i18n.text(request.action) : ""}
    </button>
  {/snippet}
</Dialog>
