<script lang="ts">
  import { t } from "svelte-i18n"

  const { url, name }: { url: string; name: string } = $props()

  let failed = $state(false)

  const mount = (host: HTMLElement) => {
    let cleanup: (() => void) | undefined
    let gone = false

    Promise.all([
      import("@eris/doc-preview"),
      fetch(url).then(response => response.arrayBuffer()),
    ])
      .then(async ([{ renderDocument }, buffer]) => {
        if (gone) {
          return
        }

        const next = await renderDocument(new Uint8Array(buffer), name, host)

        if (gone) {
          next()
        } else {
          cleanup = next
        }
      })
      .catch(() => (failed = true))

    return () => {
      gone = true
      cleanup?.()
    }
  }
</script>

{#if failed}
  <div class="flex size-full items-center justify-center text-sm text-base-content/50">
    {$t("explorer.peek.documentFailed")}
  </div>
{:else}
  {#key url}
    <div {@attach mount} class="document size-full overflow-auto bg-base-100 [--doc-preview-bg:var(--color-base-100)]"></div>
  {/key}
{/if}
