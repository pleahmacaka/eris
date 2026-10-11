<div align="center">

<img src="apps/desktop/src-tauri/icons/128x128@2x.png" width="96" alt="Eris" />

# Eris

A new shell for Windows.

**[Download for Windows](https://github.com/pleahmacaka/eris/releases/latest)** &nbsp;&nbsp; [Release notes](https://github.com/pleahmacaka/eris/releases)

</div>

## Development and agent debugging (Windows)

Install the workspace dependencies with `bun install`. Native development also
requires the Rust/MSVC toolchain and WebView2 used by Tauri.

Use the root development runner instead of calling `tauri dev` directly:

```sh
bun run dev                         # Desktop, with windows
bun run dev desktop --headless
bun run dev files --headless
bun run dev terminal --headless
```

Released Eris can stay running. The runner uses separate `.dev` app identifiers
for single-instance detection, settings and WebView storage. Debug builds also
separate shared authentication, Files sharing state and transcription credentials
from release data. Deep links use `eris-dev`, `eris-files-dev` and
`eris-terminal-dev`; production URL handlers are not replaced.

`--headless` means **real native apps and WebViews running without visible
windows**, not a browser mock or a renderer-free process. Desktop does not acquire
the dock/appbar, notification host, keyboard hook, clipboard watcher or global
launcher shortcut in this mode. Pages and Tauri commands still execute. Lazy
desktop pages can be created without showing them by invoking `show_window`.
Use headless mode when keeping the released desktop shell active: normal
windowed development can still compete for OS-wide shell resources.

### Debug without opening DevTools

Each Windows development process exposes a loopback-only WebView2 CDP endpoint:

| App | Frontend | Debug port |
| --- | --- | --- |
| `desktop` | `http://localhost:1430` | `9310` |
| `files` | `http://localhost:1440` | `9311` |
| `terminal` | `http://localhost:1450` | `9312` |

In another terminal, list targets and copy an explicit target ID:

```sh
bun run debug terminal targets
bun run debug terminal snapshot TARGET_ID
bun run debug terminal eval TARGET_ID '({ready: document.readyState, headless: window.__ERIS_HEADLESS__})'
bun run debug terminal invoke TARGET_ID 'plugin:eris-terminal|shells'
```

For desktop, identify the launcher (`/`) target, then create and inspect a lazy
page:

```sh
bun run debug desktop invoke TARGET_ID show_window '{"label":"settings"}'
bun run debug desktop targets
# Use the newly listed /settings target ID:
bun run debug desktop snapshot SETTINGS_TARGET_ID
```

`eval` awaits promises; `invoke` accepts an optional JSON object of arguments and
uses the real Tauri IPC path. Successful results are JSON on stdout. Exceptions,
unknown targets, occupied debug ports and connection failures produce diagnostics
on stderr and a nonzero exit code. Evaluations time out after 10 seconds. Targets
outside the selected app's development origin are rejected.

CDP permits arbitrary JavaScript and privileged Tauri commands. Use it only on a
trusted local machine; it is not an authenticated service or an OS sandbox.
Explicitly invoked file/system commands and network features can still affect
real resources. No debugging port is added to the shipped release configuration.
Stop the development process when finished. `--release` and custom build profiles
are rejected by the runner because its native guards require debug assertions.

Normal development is available on other supported platforms, but this headless
debugging workflow currently requires Windows/WebView2.

### Checks

```sh
bun test
bun run check
bun run lint
bun run check:native
bun run test:native
```

Pull requests run frontend checks and Windows native checks independently.
Native checks use the existing app lockfiles; no shared Cargo workspace is required.

With Windows development running and its settings window open, the opt-in UI
regression test checks real tab transitions and table-of-contents navigation:

```sh
ERIS_DEV_UI_TESTS=1 bun test apps/desktop/test/settings-navigation.test.ts
```

This switches tabs in the live development window and restores the initial tab.
Normal `bun test` skips this test, so CI does not require a running native app.

## Code organization

- `apps/*` own routes, app configuration and lifecycle. Keep route wrappers thin.
- `packages/*` own reusable capabilities and their public package exports.
- Desktop native features are grouped under `shell`, `system`, `apps` and
  `notifications`; `lib.rs` composes startup and `commands.rs` registers IPC.
- `packages/settings/src/index.ts` is the public facade. Models, defaults,
  normalization, persistence and appearance effects have separate modules.
- Shared UI components live under `packages/ui/src/lib/components`, grouped by
  purpose. Reactive shared state lives under `src/lib/store`.
- P2P protocol, persisted state, node transport, Tauri runtime and commands live
  in separate modules under `packages/sync/p2p/src`.

### Feature internals

Keep UI composition separate from testable policies and side-effect ownership:

- Desktop tray: `dock/tray/policy.ts` computes visibility, ordering and status
  presentation; `menus.ts` builds native actions; `status.svelte.ts` owns polling
  and notification subscriptions for each mounted tray.
- Calendar panel: projections and mutation plans are pure; persistence and
  subscriptions belong to its command layer. Event editing owns its draft and
  recurrence-scope workflow rather than embedding them in markup.
- Files Explorer: the reactive facade owns tab/selection state, while workflow
  modules own opening files, transfers and shell actions. Async operations retain
  their original tab instead of silently targeting whichever tab is now active.
- P2P: persisted state owns membership/rotation rules; the node owns transport
  and mutexes; the Tauri runtime owns the process-wide node and Files endpoint.

Do not create a shared abstraction merely because two route wrappers look alike.
Extract common behavior when it has a clear owner, stable contract and regression
tests; keep feature-private helpers out of public barrels.

Keep public exports, IPC/event names and persisted formats stable when reorganizing
internals. Write queues, singleton state and OS resource cleanup stay with their
owning feature; do not duplicate them in adapters or app wrappers.
