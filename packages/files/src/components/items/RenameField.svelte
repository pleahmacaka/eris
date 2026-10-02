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
    class="textarea textarea-xs w-full resize-none text-center select-text"
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
    class="input input-xs min-w-0 grow select-text"
    onblur={() => finish(true)}
    {onkeydown}
    onpointerdown={e => e.stopPropagation()}
    ondblclick={e => e.stopPropagation()}
  />
{/if}
