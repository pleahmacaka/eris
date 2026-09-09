const sortKeys = (_: string, value: unknown) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return value
  }

  const record = value as Record<string, unknown>

  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map(key => [key, record[key]]),
  )
}

export const stableJson = (value: unknown) => JSON.stringify(value, sortKeys)
