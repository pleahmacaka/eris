<script lang="ts">
  import { Confirm } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { baseName } from "../../locations"
  import { answer, pending } from "../../store/privacy.svelte"

  const open = () => pending.path !== null

  // Confirm clears `open` before calling onconfirm, so a dismissal waits a tick for the confirm to land first
  const dismiss = (next: boolean) => {
    const asked = pending.path

    if (!next && asked !== null) {
      queueMicrotask(() => {
        if (pending.path === asked) {
          answer(false)
        }
      })
    }
  }
</script>

<Confirm
  bind:open={open, dismiss}
  title={$t("explorer.privacy.title")}
  body={$t("explorer.privacy.body", {
    values: { name: baseName(pending.path ?? "") },
  })}
  action={$t("explorer.privacy.open")}
  onconfirm={() => answer(true)}
/>
