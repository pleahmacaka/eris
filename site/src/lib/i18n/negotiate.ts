export const negotiateLocale = (
  requested: readonly string[],
  supported: readonly string[],
  fallback: string,
) => {
  const subtags = (tag: string) => {
    try {
      const { language, script } = new Intl.Locale(tag).maximize()

      return [{ tag, language, script }]
    } catch {
      return []
    }
  }

  const known = supported.flatMap(subtags)
  const wanted = requested.flatMap(subtags)

  for (const exact of [true, false]) {
    for (const want of wanted) {
      const found = known.find(
        entry =>
          entry.language === want.language &&
          (!exact || entry.script === want.script),
      )

      if (found) {
        return found.tag
      }
    }
  }

  return fallback
}
