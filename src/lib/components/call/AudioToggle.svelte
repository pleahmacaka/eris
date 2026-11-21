<script lang="ts">
import Icon from "@iconify/svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"

type Kind = "mic" | "speaker"

type Props = {
  kind: Kind
  off: boolean
  surface?: "solid" | "ghost"
  disabled?: boolean
  onclick: () => void
}

const KINDS: Record<
  Kind,
  { icon: string; offIcon: string; label: MessageKey; offLabel: MessageKey }
> = {
  mic: {
    icon: "lucide:mic",
    offIcon: "lucide:mic-off",
    label: "call.audio.mute",
    offLabel: "call.audio.unmute",
  },
  speaker: {
    icon: "lucide:headphones",
    offIcon: "lucide:headphone-off",
    label: "call.audio.deafen",
    offLabel: "voice.stage.enableAudio",
  },
}

let {
  kind,
  off,
  surface = "solid",
  disabled = false,
  onclick,
}: Props = $props()

const spec = $derived(KINDS[kind])
const label = $derived(i18n.t(off ? spec.offLabel : spec.label))

import { i18n } from "#lib/i18n/i18n.svelte.js"
</script>

<button
  type="button"
  class={[
    "btn btn-square btn-sm",
    off && !disabled
      ? "btn-ghost border-error/40 text-error"
      : surface === "ghost" && "btn-ghost",
  ]}
  aria-label={label}
  title={label}
  aria-pressed={off}
  {disabled}
  {onclick}
>
  <Icon icon={off ? spec.offIcon : spec.icon} class="size-4.5" />
</button>
