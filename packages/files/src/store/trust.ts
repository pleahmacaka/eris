import { pathKey } from "../locations"
import { prefs } from "./prefs.svelte"

export const isTrusted = (root: string) =>
  prefs.trustedRepos.includes(pathKey(root))

export const trustRepo = (root: string) => {
  if (!isTrusted(root)) {
    prefs.trustedRepos = [...prefs.trustedRepos, pathKey(root)]
  }
}
