<script lang="ts">
  import DOMPurify from "dompurify"
  import { marked } from "marked"

  let { text }: { text: string } = $props()

  const html = $derived(
    DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true, breaks: true }) as string),
  )
</script>

<div class="prose-chat">{@html html}</div>
