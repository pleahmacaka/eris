<script lang="ts">
  import { registerFilesMessages } from "@eris/files"
  import { Toasts } from "@eris/ui"

  let { children } = $props()

  registerFilesMessages()
</script>

{@render children()}

<Toasts />
