<script lang="ts">
import type { ScreenId } from "#lib/landing/content.js"
import type { Copy } from "#lib/server/copy.js"
import MockFrame from "./MockFrame.svelte"
import { SCREEN_VIEWS } from "./views"

type Props = { t: Copy["showcase"]; active: ScreenId; fill?: boolean }

let { t, active, fill = false }: Props = $props()
</script>

<div class={["grid", fill && "h-full"]}>
  {#each t.screens as screen (screen.id)}
    {@const Screen = SCREEN_VIEWS[screen.id]}

    <div
      aria-hidden={active !== screen.id}
      class={[
        "col-start-1 row-start-1 min-h-0 min-w-0 transition-opacity",
        active !== screen.id && "opacity-0",
      ]}
    >
      <MockFrame label={screen.alt} {fill}>
        <Screen t={t.mock} />
      </MockFrame>
    </div>
  {/each}
</div>
