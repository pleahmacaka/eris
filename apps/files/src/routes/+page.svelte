<script lang="ts">
  import { Explorer, prefs } from "@eris/files"
  import { ThemeRows } from "@eris/ui"
</script>

<Explorer>
  {#snippet theme()}
    <ThemeRows {prefs} />
  {/snippet}
</Explorer>
