import Holidays from "date-holidays"

const engines = new Map<string, Holidays>()

const engine = (country: string, lang: string) => {
  const key = `${country}:${lang}`
  let hd = engines.get(key)

  if (!hd) {
    hd = new Holidays(country)

    try {
      hd.setLanguages(lang)
    } catch {
      // a country without that language falls back to english names
    }

    engines.set(key, hd)
  }

  return hd
}

export const systemRegion = () => {
  const candidates = [
    Intl.DateTimeFormat().resolvedOptions().locale,
    ...(globalThis.navigator?.languages ?? []),
    globalThis.navigator?.language,
  ]

  for (const tag of candidates) {
    if (!tag) {
      continue
    }

    try {
      const region = new Intl.Locale(tag).maximize().region

      if (region) {
        return region
      }
    } catch {}
  }

  return "US"
}

export const holidaysOn = (
  day: Date,
  region: string,
  lang: string,
): string[] => {
  try {
    const found = engine(region, lang).isHoliday(day)

    return found ? found.map(holiday => holiday.name) : []
  } catch {
    return []
  }
}

export const regions = (): string[] =>
  Object.keys(new Holidays().getCountries()).sort()
