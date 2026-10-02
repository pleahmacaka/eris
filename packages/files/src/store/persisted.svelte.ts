type Fields = Record<string, unknown>

export const known = <T extends Fields>(defaults: T, saved: Partial<T>): T =>
  Object.fromEntries(
    Object.keys(defaults).map(key => [
      key,
      key in saved ? saved[key] : defaults[key],
    ]),
  ) as T

export const persisted = <T extends Fields>(
  key: string,
  defaults: T,
  merge: (saved: Partial<T>) => T = saved => known(defaults, saved),
) => {
  const read = (): T => {
    try {
      return merge(JSON.parse(localStorage.getItem(key) ?? "{}") ?? {})
    } catch {
      return merge({})
    }
  }

  const value = $state<T>(read())

  $effect.root(() => {
    $effect(() => {
      localStorage.setItem(key, JSON.stringify(value))
    })
  })

  window.addEventListener("storage", e => {
    if (e.key === key) {
      Object.assign(value, read())
    }
  })

  return value
}
