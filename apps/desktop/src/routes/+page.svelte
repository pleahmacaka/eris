<script lang="ts">
  import { loadProfile, onDevice, onProfile } from "@eris/settings"
  import { listen } from "@tauri-apps/api/event"
  import { ensureDevice } from "$lib/device"
  import { watchEdit } from "$lib/edit"
  import {
    contextmenu,
    keydown,
    Launcher,
    LauncherFooter,
    LauncherMenus,
    loadFrecency,
    mousedown,
    ResultList,
    SearchBox,
    subscribeTimers,
  } from "$lib/launcher"
  import { onAppsChanged } from "$lib/native/apps"
  import { onWindowShown } from "$lib/native/windows"

  const launcher = new Launcher()

  $effect(() => {
    ensureDevice()
      .then(d => {
        launcher.device = d
      })
      .catch(() => undefined)
    loadFrecency().then(() => {
      launcher.usage += 1
    })
    loadProfile().then(p => {
      launcher.profile = p
    })
    launcher.refresh()

    const stopTimers = subscribeTimers(items => {
      launcher.timers = items
    })
    const stopEditWatch = watchEdit()

    const stops = [
      onProfile(p => {
        launcher.profile = p
      }),
      onDevice(d => {
        launcher.device = d
      }),
      onWindowShown("main", () => {
        launcher.setQuery("")
        launcher.usage += 1
        launcher.refresh()
        launcher.input?.focus()
      }),
      onAppsChanged(() => launcher.refreshApps()),
      listen<string>("launcher-query", e => {
        launcher.setQuery(e.payload)
        launcher.input?.focus()
      }),
    ]

    return () => {
      stopTimers()
      stopEditWatch()

      for (const stop of stops) {
        stop.then(fn => fn())
      }
    }
  })

  $effect(() => {
    launcher.input?.focus()
  })

  $effect(() => {
    if (launcher.clipMode) {
      launcher.refreshClips()
    }
  })
</script>

<svelte:window
  onkeydown={e => keydown(launcher, e)}
  onmousedown={e => mousedown(launcher, e)}
  onfocus={() => launcher.input?.focus()}
/>

<main
  class="relative flex min-h-0 grow select-none flex-col gap-3 p-4"
  oncontextmenu={e => contextmenu(launcher, e)}
>
  <SearchBox {launcher} />

  <div
    data-launcher
    class="eris-card flex min-h-0 grow flex-col overflow-hidden"
  >
    <ResultList {launcher} />

    <LauncherFooter {launcher} />
  </div>

  <LauncherMenus {launcher} />
</main>
