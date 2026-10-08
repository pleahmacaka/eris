<script lang="ts">
  import { Row, Section, Segmented } from "@eris/ui"
  import { defaultShell, loadShells, session } from "@eris/terminal"
  import { t } from "svelte-i18n"
  import { terminal, terminalPrefs } from "../../store/terminal.svelte"

  $effect(() => {
    loadShells()
  })
</script>

<Section title={$t("terminal.title")}>
  <Row label={$t("terminal.settings.position")}>
    <Segmented
      label={$t("terminal.settings.position")}
      bind:value={
        () => terminalPrefs.position,
        position => {
          terminalPrefs.position = position
          terminal.position = null
        }
      }
      options={[
        { value: "bottom", label: $t("terminal.settings.bottom") },
        { value: "side", label: $t("terminal.settings.side") },
      ]}
    />
  </Row>

  <Row label={$t("terminal.settings.shell")}>
    <select
      class="select select-sm w-44"
      aria-label={$t("terminal.settings.shell")}
      value={defaultShell(terminalPrefs.shell)}
      onchange={e => (terminalPrefs.shell = e.currentTarget.value)}
    >
      {#each session.shells as shell (shell.id)}
        <option value={shell.id}>{shell.name}</option>
      {/each}
    </select>
  </Row>

  <Row
    label={$t("terminal.settings.font")}
    hint={$t("terminal.settings.fontHint")}
  >
    <input
      class="input input-sm w-44"
      aria-label={$t("terminal.settings.font")}
      spellcheck="false"
      bind:value={terminalPrefs.fontFamily}
    />
  </Row>
</Section>
