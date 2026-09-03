import { readFileSync, writeFileSync } from "node:fs"

const version = process.argv[2]?.trim()

if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  throw new Error(`expected a semver argument, got "${version ?? ""}"`)
}

const rewrite = (path: string) => {
  const source = JSON.parse(readFileSync(path, "utf8"))

  source.version = version
  writeFileSync(path, `${JSON.stringify(source, null, 2)}\n`)
}

rewrite("package.json")
rewrite("src-tauri/tauri.conf.json")

const cargo = readFileSync("src-tauri/Cargo.toml", "utf8")

writeFileSync(
  "src-tauri/Cargo.toml",
  cargo.replace(/^version = ".*"$/m, `version = "${version}"`),
)

console.log(`version set to ${version}`)
