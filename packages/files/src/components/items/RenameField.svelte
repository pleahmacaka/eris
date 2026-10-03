<script lang="ts">
  import { untrack } from "svelte"

  let {
    value,
    stem = value.length,
    multiline = false,
    oncommit,
    oncancel,
  }: {
    value: string
    stem?: number
    multiline?: boolean
    oncommit: (draft: string) => void
    oncancel: () => void
  } = $props()

  let draft = $state(untrack(() => value))
  let settled = false

  const finish = (commit: boolean) => {
    if (settled) {
      return
    }

    settled = true

    if (commit) {
      oncommit(draft)
    } else {
      oncancel()
    }
  }

  const attach = (field: HTMLInputElement | HTMLTextAreaElement) => {
    field.focus()
    field.setSelectionRange(0, stem)
  }

  const onkeydown = (e: KeyboardEvent) => {
    e.stopPropagation()

    if (e.key === "Enter") {
      e.preventDefault()
      finish(true)
    }

    if (e.key === "Escape") {
      e.preventDefault()
      finish(false)
    }
  }
</script>

{#if multiline}
  <textarea
    {@attach attach}
    bind:value={draft}
    rows="2"
    spellcheck="false"
    class="textarea min-h-0 w-full resize-none px-1.5 py-1 text-center text-xs leading-snug select-text"
    onblur={() => finish(true)}
    {onkeydown}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
  ></textarea>
{:else}
  <input
    {@attach attach}
    bind:value={draft}
    spellcheck="false"
    class="input h-7 min-w-0 grow px-2 text-sm select-text"
    onblur={() => finish(true)}
    {onkeydown}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
  />
{/if}
