import { readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { type AppName, appName, root } from "./apps"

const ALL: AppName[] = ["desktop", "files", "terminal"]

const run = async (cmd: string[], cwd = root) => {
  const child = Bun.spawn(cmd, {
    cwd,
    env: { ...process.env, ERIS_DEV_CHANNEL: "1" },
    stdio: ["inherit", "inherit", "inherit"],
    windowsHide: true,
  })
  const code = await child.exited

  if (code !== 0) {
    throw new Error(`${cmd.join(" ")} exited with ${code}`)
  }
}

const newestSetup = (app: AppName) => {
  const dir = resolve(root, "apps", app, "src-tauri/target/release/bundle/nsis")
  const setups = readdirSync(dir)
    .filter(name => name.endsWith("-setup.exe") && name.includes(" Dev_"))
    .map(name => resolve(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

  if (!setups[0]) {
    throw new Error(`No dev-channel setup found in ${dir}`)
  }

  return setups[0]
}

const targets = process.argv.slice(2).map(appName)

for (const app of targets.length ? targets : ALL) {
  console.log(`== ${app}`)

  await run(
    [
      "bun",
      "x",
      "tauri",
      "build",
      "--bundles",
      "nsis",
      "--config",
      "src-tauri/tauri.dev.conf.json",
    ],
    resolve(root, "apps", app),
  )

  const setup = newestSetup(app)

  console.log(`installing ${setup}`)
  await run([setup, "/S"])
}
