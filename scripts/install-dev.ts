import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { type AppName, appName, root } from "./apps"

const ALL: AppName[] = ["desktop", "files", "terminal"]
const TARGET = resolve(root, "target")
const STAMPS = resolve(TARGET, "dev-channel-stamps")
const ROOT_INPUTS = ["package.json", "bun.lock", ".cargo/config.toml"]

const env = {
  ...process.env,
  ERIS_DEV_CHANNEL: "1",
  CARGO_TARGET_DIR: TARGET,
  CARGO_PROFILE_RELEASE_LTO: "false",
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS: "16",
  CARGO_PROFILE_RELEASE_INCREMENTAL: "true",
}

const run = async (cmd: string[], cwd = root) => {
  const child = Bun.spawn(cmd, {
    cwd,
    env,
    stdio: ["inherit", "inherit", "inherit"],
    windowsHide: true,
  })
  const code = await child.exited

  if (code !== 0) {
    throw new Error(`${cmd.join(" ")} exited with ${code}`)
  }
}

const workspacePackages = async () => {
  const found = new Map<string, string>()
  const glob = new Bun.Glob("packages/**/package.json")

  for await (const file of glob.scan({ cwd: root, onlyFiles: true })) {
    if (file.includes("node_modules")) {
      continue
    }

    const manifest = await Bun.file(resolve(root, file)).json()

    found.set(manifest.name, dirname(resolve(root, file)))
  }

  return found
}

type CargoDeps = Record<string, string | { path?: string }>

const pathDeps = (deps: CargoDeps | undefined, base: string) =>
  Object.values(deps ?? {}).flatMap(dep =>
    typeof dep === "object" && dep.path ? [resolve(base, dep.path)] : [],
  )

const rustInputs = async (crate: string, seen: Set<string>) => {
  const manifest = resolve(crate, "Cargo.toml")

  if (seen.has(crate) || !existsSync(manifest)) {
    return
  }

  seen.add(crate)

  const toml = Bun.TOML.parse(await Bun.file(manifest).text()) as {
    dependencies?: CargoDeps
    "build-dependencies"?: CargoDeps
    target?: Record<string, { dependencies?: CargoDeps }>
  }
  const deps = [
    ...pathDeps(toml.dependencies, crate),
    ...pathDeps(toml["build-dependencies"], crate),
    ...Object.values(toml.target ?? {}).flatMap(target =>
      pathDeps(target.dependencies, crate),
    ),
  ]

  for (const dep of deps) {
    await rustInputs(dep, seen)
  }
}

const jsInputs = async (
  dir: string,
  packages: Map<string, string>,
  seen: Set<string>,
) => {
  if (seen.has(dir)) {
    return
  }

  seen.add(dir)

  const manifest = await Bun.file(resolve(dir, "package.json")).json()
  const deps = { ...manifest.dependencies, ...manifest.devDependencies }

  for (const [name, version] of Object.entries(deps)) {
    const local = packages.get(name)

    if (local && String(version).startsWith("workspace:")) {
      await jsInputs(local, packages, seen)
    }
  }
}

const inputDirs = async (app: AppName, packages: Map<string, string>) => {
  const dirs = new Set<string>()
  const appDir = resolve(root, "apps", app)

  await jsInputs(appDir, packages, dirs)
  await rustInputs(resolve(appDir, "src-tauri"), dirs)

  return [...dirs].map(dir => relative(root, dir).replaceAll("\\", "/"))
}

const fingerprint = async (dirs: string[]) => {
  const listed = Bun.spawnSync(
    [
      "git",
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...dirs,
      ...ROOT_INPUTS,
    ],
    { cwd: root },
  )
  const files = [...new Set(listed.stdout.toString().split("\0"))]
    .filter(file => file && existsSync(resolve(root, file)))
    .sort()
  const hasher = new Bun.CryptoHasher("sha256")

  for (const file of files) {
    hasher.update(file)
    hasher.update(await Bun.file(resolve(root, file)).arrayBuffer())
  }

  return hasher.digest("hex")
}

const stampOf = (app: AppName) => resolve(STAMPS, `${app}.txt`)

const readStamp = async (app: AppName) => {
  const file = Bun.file(stampOf(app))

  return (await file.exists()) ? (await file.text()).trim() : null
}

const newestSetup = async (app: AppName) => {
  const overlay = resolve(root, "apps", app, "src-tauri/tauri.dev.conf.json")
  const { productName } = await Bun.file(overlay).json()
  const dir = resolve(TARGET, "release/bundle/nsis")
  const setups = readdirSync(dir)
    .filter(
      name => name.startsWith(`${productName}_`) && name.endsWith("-setup.exe"),
    )
    .map(name => resolve(dir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)

  if (!setups[0]) {
    throw new Error(`No ${productName} setup found in ${dir}`)
  }

  return setups[0]
}

const args = process.argv.slice(2)
const force = args.includes("--force")
const named = args.filter(arg => arg !== "--force").map(appName)
const packages = await workspacePackages()

mkdirSync(STAMPS, { recursive: true })

for (const app of named.length ? named : ALL) {
  const stamp = await fingerprint(await inputDirs(app, packages))

  if (!force && stamp === (await readStamp(app))) {
    console.log(`== ${app}: unchanged since the last install, skipped`)
    continue
  }

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

  const setup = await newestSetup(app)

  console.log(`installing ${setup}`)
  await run([setup, "/S"])
  await Bun.write(stampOf(app), stamp)
}
