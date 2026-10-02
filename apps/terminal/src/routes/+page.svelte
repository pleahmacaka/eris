<script lang="ts">
  import { prefs, TerminalApp } from "@eris/terminal"
  import { ThemeRows } from "@eris/ui"
</script>

<TerminalApp>
  {#snippet theme()}
    <ThemeRows {prefs} />
  {/snippet}
</TerminalApp>
