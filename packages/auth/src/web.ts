import { Account } from "./account.svelte"

let shared: Account | undefined

export const webAccount = () => {
  shared ??= new Account({ redirectTo: `${location.origin}/auth/callback/` })

  return shared
}
