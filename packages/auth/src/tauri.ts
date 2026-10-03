import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { Account } from "./account.svelte"

export { default as DesktopAccount } from "./DesktopAccount.svelte"

const call = <T>(command: string, args?: Record<string, unknown>) =>
  invoke<T>(`plugin:eris-auth|${command}`, args)

const storage = {
  getItem: (key: string) => call<string | null>("load", { key }),
  setItem: (key: string, value: string) => call<void>("store", { key, value }),
  removeItem: (key: string) => call<void>("forget", { key }),
}

let shared: Promise<Account> | undefined

const connect = async () => {
  const account = new Account({
    redirectTo: await call<string>("redirect"),
    storage,
    openUrl: url => call<void>("open_authorize", { url }),
  })

  const consume = async () => {
    const callback = await call<string | null>("take_callback")

    if (!callback) {
      return
    }

    account.failure = null
    await account.exchangeCodeForSession(callback).catch(error => {
      account.failure = error
    })
  }

  await listen("eris-auth-callback", consume)
  await listen("eris-auth-changed", account.reload)
  window.addEventListener("focus", account.reload)
  await consume()
  await account.reload()

  return account
}

export const desktopAccount = () => {
  shared ??= connect()

  return shared
}
