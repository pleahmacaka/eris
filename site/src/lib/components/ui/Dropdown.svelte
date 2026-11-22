<script lang="ts">
import type { Snippet } from "svelte"
import { dismissible } from "#lib/attachments/dismissible.js"

type Props = { id: string; trigger: Snippet; children: Snippet }

let { id, trigger, children }: Props = $props()
</script>

<button
  type="button"
  class="btn btn-ghost btn-sm"
  popovertarget={id}
  style:anchor-name="--{id}"
>
  {@render trigger()}
</button>

<div
  {id}
  popover
  class={[
    "dropdown dropdown-end mt-2 rounded-box border p-2",
    "border-base-content/10 bg-base-200 shadow-xl",
  ]}
  style:position-anchor="--{id}"
  {@attach dismissible}
>
  {@render children()}
</div>
