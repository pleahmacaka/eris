import { createServer } from "node:net"
import {
  type AppName,
  appName,
  apps,
  readAppConfig,
  requireWindows,
} from "./apps"

export const devHelp = `Usage: bun run dev [desktop|files|terminal] [--headless] [Tauri dev arguments]
Defaults to desktop. Windows dev launches expose app-local WebView2 CDP on
127.0.0.1:9310 (desktop), :9311 (files), or :9312 (terminal).
--headless keeps app windows hidden (Windows only).
Uses a separate .dev application identity and dev-only deep-link schemes.`

// Tauri windows that set no arguments get these from wry; setting any replaces them, so dev args carry them too.
const WRY_DEFAULT_ARGS =
  "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --autoplay-policy=no-user-gesture-required"

export function parseDevArgs(args: string[]) {
  const remaining = [...args]
  const app =
    remaining[0] && !remaining[0].startsWith("-")
      ? appName(remaining.shift() as string)
      : "desktop"
  // Anything after -- belongs to Cargo, not this runner.
  const separator = remaining.indexOf("--")
  const end = separator < 0 ? remaining.length : separator
  const headless = remaining.slice(0, end).includes("--headless")
  return {
    app,
    headless,
    args: remaining.filter(
      (arg, index) => index >= end || arg !== "--headless",
    ),
  }
}

export async function devPlan(
  options: ReturnType<typeof parseDevArgs>,
  platform = process.platform,
  inherited: NodeJS.ProcessEnv = process.env,
) {
  // Tauri passes arguments after the first -- to Cargo; only a second --
  // starts application arguments.
  const separatorIndex = options.args.indexOf(
    "--",
    options.args.indexOf("--") + 1,
  )
  const buildArgs = options.args.slice(
    0,
    separatorIndex < 0 ? undefined : separatorIndex,
  )
  if (
    buildArgs.some(
      arg =>
        arg === "--release" ||
        arg === "--profile" ||
        arg.startsWith("--profile="),
    )
  ) {
    throw new Error(
      "The dev runner requires the default debug profile; --release and --profile would disable development isolation and headless guards.",
    )
  }
  if (
    inherited.CARGO_PROFILE_DEV_DEBUG_ASSERTIONS === "false" ||
    inherited.CARGO_PROFILE_DEV_DEBUG_ASSERTIONS === "0"
  ) {
    throw new Error(
      "The dev runner requires Cargo dev debug assertions for development isolation.",
    )
  }
  if (options.headless) {
    requireWindows(platform)
  }
  const config = await readAppConfig(options.app)
  const debugArgs = `--remote-debugging-port=${apps[options.app].port} --remote-debugging-address=127.0.0.1`
  const hidden = options.headless ? { visible: false, focus: false } : {}
  const override = {
    identifier: `${config.identifier}.dev`,
    productName: `${config.productName} Dev`,
    plugins: {
      "deep-link": { desktop: { schemes: apps[options.app].schemes } },
    },
    app: {
      windows: config.app.windows.map(window => ({
        ...window,
        ...hidden,
        ...(platform === "win32" && {
          additionalBrowserArgs: `${window.additionalBrowserArgs ?? WRY_DEFAULT_ARGS} ${debugArgs}`,
        }),
      })),
    },
  }
  const args = [...options.args]
  const separator = args.indexOf("--")
  args.splice(
    separator < 0 ? args.length : separator,
    0,
    "--config",
    JSON.stringify(override),
    ...apps[options.app].features.flatMap(feature => ["--features", feature]),
  )
  const env = { ...inherited }
  delete env.ERIS_DEV_HEADLESS
  // Never inherit an unrelated debugging endpoint.
  const browserArgs = (env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? "")
    .replace(/--remote-debugging-(?:port|address)(?:=|\s+)\S+/g, "")
    .trim()
  if (platform === "win32") {
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = [
      WRY_DEFAULT_ARGS,
      browserArgs,
      debugArgs,
    ]
      .filter(Boolean)
      .join(" ")
  } else if (browserArgs) {
    env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = browserArgs
  } else {
    delete env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
  }
  if (options.headless) {
    env.ERIS_DEV_HEADLESS = "1"
  }
  return {
    command: [
      "bun",
      "run",
      "--cwd",
      `apps/${options.app}`,
      "tauri",
      "dev",
      ...args,
    ],
    env,
  }
}

export function assertPortAvailable(
  app: AppName,
  port: number = apps[app].port,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", error => {
      reject(
        new Error(
          `Cannot start ${app}: CDP port 127.0.0.1:${port} is unavailable (${error.message}). Stop the existing process first; refusing to attach to it.`,
        ),
      )
    })
    server.listen(port, "127.0.0.1", () => {
      server.close(error => (error ? reject(error) : resolve()))
    })
  })
}
