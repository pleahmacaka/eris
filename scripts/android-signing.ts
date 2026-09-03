import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const gradleFile = resolve("src-tauri/gen/android/app/build.gradle.kts")

if (!existsSync(gradleFile)) {
  throw new Error(`missing ${gradleFile}; run tauri android init first`)
}

const signingConfigs = `    signingConfigs {
        create("release") {
            val propertiesFile = rootProject.file("keystore.properties")
            val properties = Properties()

            if (propertiesFile.exists()) {
                propertiesFile.inputStream().use { properties.load(it) }
            }

            keyAlias = properties["keyAlias"] as String
            keyPassword = properties["password"] as String
            storeFile = file(properties["storeFile"] as String)
            storePassword = properties["storePassword"] as String
        }
    }

`

let source = readFileSync(gradleFile, "utf8")

if (source.includes("signingConfigs {")) {
  console.log("android signing already configured")
  process.exit(0)
}

if (!source.includes("import java.util.Properties")) {
  source = `import java.util.Properties
${source}`
}

const androidBlock = source.indexOf("android {")

if (androidBlock === -1) {
  throw new Error("no android block in build.gradle.kts")
}

const insertAt = source.indexOf("\n", androidBlock) + 1
const withConfigs =
  source.slice(0, insertAt) + signingConfigs + source.slice(insertAt)

const releaseBlock = withConfigs.indexOf(`getByName("release") {`)

if (releaseBlock === -1) {
  throw new Error("no release build type in build.gradle.kts")
}

const releaseAt = withConfigs.indexOf("\n", releaseBlock) + 1

writeFileSync(
  gradleFile,
  withConfigs.slice(0, releaseAt) +
    `            signingConfig = signingConfigs.getByName("release")\n` +
    withConfigs.slice(releaseAt),
)

console.log("android release signing wired into build.gradle.kts")
