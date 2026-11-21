const manifestPath = new URL(
  "../src-tauri/gen/android/app/src/main/AndroidManifest.xml",
  import.meta.url,
)
const internetPermission =
  '<uses-permission android:name="android.permission.INTERNET" />'
const audioPermissions = [
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
]
const launchMode = 'android:launchMode="singleTask"'
const softInputMode = 'android:windowSoftInputMode="adjustResize"'

const ensureAudioPermissions = (source: string) => {
  const missing = audioPermissions.filter(
    name => !source.includes(`android:name="${name}"`),
  )

  if (missing.length === 0) {
    return source
  }

  if (!source.includes(internetPermission)) {
    throw new Error("INTERNET permission not found in AndroidManifest.xml")
  }

  const lines = missing.map(
    name => `    <uses-permission android:name="${name}" />`,
  )

  return source.replace(
    internetPermission,
    [internetPermission, ...lines].join("\n"),
  )
}

const ensureSoftInputMode = (source: string) => {
  if (source.includes(softInputMode)) {
    return source
  }

  if (!source.includes(launchMode)) {
    throw new Error("MainActivity launchMode not found in AndroidManifest.xml")
  }

  return source.replace(
    launchMode,
    `${launchMode}\n            ${softInputMode}`,
  )
}

const manifest = Bun.file(manifestPath)

if (await manifest.exists()) {
  const source = await manifest.text()
  const patched = ensureSoftInputMode(ensureAudioPermissions(source))

  if (patched !== source) {
    await Bun.write(manifestPath, patched)
    console.log("android manifest: audio permissions and adjustResize restored")
  }
} else {
  console.log(
    "android manifest: not generated yet, run tauri android init first",
  )
}
