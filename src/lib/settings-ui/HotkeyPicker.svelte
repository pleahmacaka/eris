<script lang="ts">
  import Icon from "@iconify/svelte"

  let { value = $bindable() }: { value: string } = $props()

  const DEFAULT = "Alt+Space"

  const modifierCodes = new Set([
    "ControlLeft",
    "ControlRight",
    "AltLeft",
    "AltRight",
    "ShiftLeft",
    "ShiftRight",
    "MetaLeft",
    "MetaRight",
  ])

  const namedKeys = new Set([
    "Space",
    "Enter",
    "Tab",
    "Backspace",
    "Delete",
    "Insert",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Comma",
    "Period",
    "Slash",
    "Backslash",
    "Semicolon",
    "Quote",
    "Backquote",
    "Minus",
    "Equal",
    "BracketLeft",
    "BracketRight",
  ])

  const keyName = (code: string) => {
    if (code.startsWith("Key")) {
      return code.slice(3)
    }

    if (code.startsWith("Digit")) {
      return code.slice(5)
    }

    if (code.startsWith("Arrow")) {
      return code.slice(5)
    }

    if (code.startsWith("F") && Number.isInteger(Number(code.slice(1)))) {
      return code
    }

    return namedKeys.has(code) ? code : null
  }

  let recording = $state(false)
  let error = $state("")

  const chips = $derived(
    value.split("+").map(part => (part === "Super" ? "Win" : part)),
  )

  const onkeydown = (e: KeyboardEvent) => {
    if (!recording) {
      return
    }

    e.preventDefault()
    e.stopPropagation()

    if (e.code === "Escape") {
      recording = false
      error = ""

      return
    }

    if (modifierCodes.has(e.code)) {
      return
    }

    const key = keyName(e.code)

    if (!key) {
      error = "That key is not supported"

      return
    }

    const modifiers = [
      e.ctrlKey && "Ctrl",
      e.altKey && "Alt",
      e.shiftKey && "Shift",
      e.metaKey && "Super",
    ].filter(Boolean)

    if (modifiers.length === 0) {
      error = "Add a modifier such as Ctrl or Alt"

      return
    }

    value = [...modifiers, key].join("+")
    recording = false
    error = ""
  }

  const toggle = () => {
    recording = !recording
    error = ""
  }
</script>

<div class="flex flex-col items-end gap-1">
  <div class="flex items-center gap-2">
    <button
      type="button"
      class={[
        "btn btn-sm gap-1 transition-colors duration-150",
        recording ? "btn-primary" : "btn-soft",
      ]}
      aria-label={recording ? "Recording shortcut" : "Change shortcut"}
      onclick={toggle}
      {onkeydown}
      onblur={() => (recording = false)}
    >
      {#if recording}
        <Icon icon="lucide:circle-dot" class="size-4 animate-pulse" />
        Press keys
      {:else}
        {#each chips as chip, at (at)}
          <kbd class="kbd kbd-sm">{chip}</kbd>
        {/each}
      {/if}
    </button>

    <button
      type="button"
      class="btn btn-ghost btn-sm"
      disabled={value === DEFAULT}
      onclick={() => (value = DEFAULT)}
    >
      Reset
    </button>
  </div>

  {#if error}
    <span class="text-xs text-error">{error}</span>
  {:else if recording}
    <span class="text-xs text-base-content/60">Esc cancels</span>
  {/if}
</div>
