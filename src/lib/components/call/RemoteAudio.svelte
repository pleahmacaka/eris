<script lang="ts">
import { audioStore } from "#lib/store/audio.svelte.js"

let { stream }: { stream: MediaStream } = $props()

const play = (node: HTMLAudioElement) => {
  node.srcObject = stream

  return () => {
    node.srcObject = null
  }
}

const route = (node: HTMLAudioElement) => {
  if (audioStore.outputSelectable) {
    node.setSinkId(audioStore.prefs.outputId ?? "").catch((error: unknown) => {
      console.warn("audio output switch failed", error)
    })
  }
}
</script>

<audio {@attach play} {@attach route} autoplay></audio>
