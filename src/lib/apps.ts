import { appIcon as fetchIcon } from "./native"

const RETRY_AFTER = 30_000

const icons = new Map<string, Promise<string | null>>()
const failedAt = new Map<string, number>()

export const appIcon = (path: string) => {
  const cached = icons.get(path)

  if (cached) {
    return cached
  }

  const lastFailure = failedAt.get(path)

  if (lastFailure !== undefined && Date.now() - lastFailure < RETRY_AFTER) {
    return Promise.resolve(null)
  }

  const pending = fetchIcon(path)
    .catch(() => null)
    .then(icon => {
      if (icon === null) {
        icons.delete(path)
        failedAt.set(path, Date.now())
      } else {
        failedAt.delete(path)
      }

      return icon
    })

  icons.set(path, pending)

  return pending
}
