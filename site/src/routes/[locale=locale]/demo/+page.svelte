<script lang="ts">
import "virtual:iconify-embed"
import "../../../app.css"
import Demo from "#lib/components/demo/Demo.svelte"
import Head from "#lib/components/seo/Head.svelte"
import type { PageProps } from "./$types"

let { data }: PageProps = $props()

const t = $derived(data.copy)
</script>

<Head meta={t.demo.meta} seo={data.seo} />

<a
  class={[
    "btn btn-primary btn-sm sr-only",
    "focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50",
  ]}
  href="#content"
>
  {t.nav.skip}
</a>

<Demo {t} />
