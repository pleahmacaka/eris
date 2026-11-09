<script lang="ts">
  import { Confirm } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { answerRemoval, removal } from "../../store/removal.svelte"

  const open = () => removal.names !== null

  // Confirm clears `open` before calling onconfirm, so a dismissal waits a tick for the confirm to land first
  const dismiss = (next: boolean) => {
    const asked = removal.names

    if (!next && asked !== null) {
      queueMicrotask(() => {
        if (removal.names === asked) {
          answerRemoval(false)
        }
      })
    }
  }
</script>

<Confirm
  bind:open={open, dismiss}
  title={$t("explorer.removePlace.title")}
  body={$t("explorer.removePlace.body", {
    values: { name: removal.names?.join(", ") ?? "" },
  })}
  action={$t("explorer.removePlace.action")}
  onconfirm={() => answerRemoval(true)}
/>
