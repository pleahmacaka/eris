# Eris

## Development (Windows)

- `bun install`. Native builds need Rust/MSVC and WebView2.
- Run apps through the root runner, never `tauri dev` directly:
  - `bun run dev` (desktop, windowed)
  - `bun run dev <desktop|files|terminal> --headless`
- Prefer `--headless` so the released Eris keeps the dock/appbar, notification host, keyboard hook, clipboard watcher and launcher shortcut. Headless runs real native apps and WebViews without visible windows; pages and Tauri commands still execute.
- Dev builds use `.dev` identifiers, separate storage and credentials, and `eris-dev` / `eris-files-dev` / `eris-terminal-dev` deep links. Released Eris can stay running.
- `--release` and custom build profiles are rejected; the native guards need debug assertions.
- Stop the dev process when finished.

## Debugging through CDP

Each dev process exposes a loopback-only WebView2 CDP endpoint. Never open DevTools.

| App        | Frontend                | Debug port |
| ---------- | ----------------------- | ---------- |
| `desktop`  | `http://localhost:1430` | `9310`     |
| `files`    | `http://localhost:1440` | `9311`     |
| `terminal` | `http://localhost:1450` | `9312`     |

```sh
bun run debug <app> targets
bun run debug <app> snapshot TARGET_ID
bun run debug <app> eval TARGET_ID '({ready: document.readyState, headless: window.__ERIS_HEADLESS__})'
bun run debug <app> invoke TARGET_ID COMMAND ['{"json":"args"}']
```

- Desktop lazy pages: `invoke` the launcher (`/`) target with `show_window '{"label":"settings"}'`, list `targets` again, then use the new target ID.
- `eval` awaits promises and times out after 10 seconds. `invoke` uses the real Tauri IPC path, for example `invoke TARGET_ID 'plugin:eris-terminal|shells'`.
- Targets outside the app's dev origin are rejected.
- Success is JSON on stdout. Failures go to stderr with a nonzero exit code.
- Commands act on real files, system state and network. Headless CDP works only on Windows.

## Checks

```sh
bun test
bun run check
bun run lint
bun run check:native
bun run test:native
```

Opt-in, Windows desktop only:

- Audio hardware: `cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml --lib system::audio::tests::the_default_endpoint_can_be_reassigned_to_itself -- --ignored`
- Settings UI, with dev running and the settings window open: `ERIS_DEV_UI_TESTS=1 bun test apps/desktop/test/settings-navigation.test.ts`

## Code organization

- `apps/*` own routes, app config and lifecycle. Keep route wrappers thin.
- `packages/*` own reusable capabilities and their public exports.
- Desktop native code is grouped under `shell`, `system`, `apps` and `notifications`. `lib.rs` composes startup; `commands.rs` registers IPC.
- `packages/settings/src/index.ts` is the public facade over separate model, default, normalization, persistence and appearance modules.
- Shared UI components live in `packages/ui/src/lib/components`, grouped by purpose. Shared reactive state lives in `src/lib/store`.
- `packages/sync/p2p/src` splits protocol, persisted state, node transport, Tauri runtime and commands into separate modules.

Ownership:

- Desktop tray: `dock/tray/policy.ts` is pure visibility, ordering and status. `menus.ts` builds native actions. `status.svelte.ts` owns polling and notification subscriptions per mounted tray.
- Calendar panel: projections and mutation plans are pure. Persistence and subscriptions belong to the command layer. Event editing owns its draft and recurrence-scope workflow.
- Files Explorer: the reactive facade owns tab and selection state. Workflow modules own opening files, transfers and shell actions. Async operations keep their original tab, never the currently active one.
- P2P: persisted state owns membership and rotation rules. The node owns transport and mutexes. The Tauri runtime owns the process-wide node and Files endpoint.

Rules:

- Extract a shared abstraction only when it has a clear owner, a stable contract and regression tests. Two similar route wrappers are not enough.
- Keep feature-private helpers out of public barrels.
- Keep public exports, IPC/event names and persisted formats stable when reorganizing.
- Write queues, singleton state and OS resource cleanup stay with their owning feature. Never duplicate them in adapters or app wrappers.
