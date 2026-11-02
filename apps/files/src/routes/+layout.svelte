<script lang="ts">
  import { prefs } from "@eris/files"
  import { followEris, StandaloneShell } from "@eris/ui"
  import { page } from "$app/state"
  import { error } from "@tauri-apps/plugin-log"
  import "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  followEris(prefs, { reveal: page.route.id !== "/menu" })

  const describe = (reason: unknown) =>
    reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)

  const report = (message: string) => {
    error(`${page.url.pathname}: ${message}`).catch(() => undefined)
  }

  $effect(() => {
    const failed = (e: ErrorEvent) => report(describe(e.error ?? e.message))
    const rejected = (e: PromiseRejectionEvent) =>
      report(`unhandled rejection: ${describe(e.reason)}`)

    window.addEventListener("error", failed)
    window.addEventListener("unhandledrejection", rejected)

    return () => {
      window.removeEventListener("error", failed)
      window.removeEventListener("unhandledrejection", rejected)
    }
  })
</script>

<StandaloneShell dense>
  {@render children()}
</StandaloneShell>
