# is-screen-sharing

Detect whether the screen is currently being shared, so an app can hide private content during a call or a stream.

```js
const isScreenSharing = require("is-screen-sharing")

if (isScreenSharing()) {
  // hide private content
}
```

On a platform without support the function returns `false`.

## Platforms

| Platform | Supported |
| --- | :---: |
| Windows (x64, arm64) | ✅ |
| macOS | ❌ |
| Linux | ❌ |

## Detected sources

| Source | Windows | macOS | Linux |
| --- | :---: | :---: | :---: |
| Apps using the Graphics Capture API (Discord, OBS, Teams, browsers) | ✅ | ❌ | ❌ |
| Browser sharing bars (Chrome, Edge, Brave) | ✅ | ❌ | ❌ |
| Zoom | ✅ | ❌ | ❌ |

## Rust

The detection lives in the `is-screen-sharing` crate under `core/`:

```rust
let sharing = is_screen_sharing::is_screen_sharing();
```
