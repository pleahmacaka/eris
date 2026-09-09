import { parseNumber } from "./calc"

type Dimension =
  | "length"
  | "mass"
  | "temperature"
  | "time"
  | "data"
  | "speed"
  | "area"
  | "volume"
  | "angle"

type Unit = { dimension: Dimension; symbol: string; factor: number }

const TABLE: [Dimension, string, number, string][] = [
  ["length", "mm", 0.001, "mm millimeter millimetre"],
  ["length", "cm", 0.01, "cm centimeter centimetre"],
  ["length", "m", 1, "m meter metre"],
  ["length", "km", 1000, "km kilometer kilometre"],
  ["length", "in", 0.0254, "in inch inches"],
  ["length", "ft", 0.3048, "ft foot feet"],
  ["length", "yd", 0.9144, "yd yard"],
  ["length", "mi", 1609.344, "mi mile"],
  ["length", "nmi", 1852, "nmi nauticalmile"],
  ["mass", "mg", 0.000001, "mg milligram"],
  ["mass", "g", 0.001, "g gram"],
  ["mass", "kg", 1, "kg kilogram"],
  ["mass", "t", 1000, "t ton tonne"],
  ["mass", "oz", 0.028349523125, "oz ounce"],
  ["mass", "lb", 0.45359237, "lb lbs pound"],
  ["mass", "st", 6.35029318, "st stone"],
  ["temperature", "°C", 1, "c celsius centigrade °c ℃"],
  ["temperature", "°F", 1, "f fahrenheit °f ℉"],
  ["temperature", "K", 1, "k kelvin"],
  ["time", "ms", 0.001, "ms millisecond"],
  ["time", "s", 1, "s sec second"],
  ["time", "min", 60, "min minute"],
  ["time", "h", 3600, "h hr hour"],
  ["time", "d", 86400, "d day"],
  ["time", "wk", 604800, "wk week"],
  ["data", "B", 1, "b byte"],
  ["data", "KB", 1000, "kb kilobyte"],
  ["data", "MB", 1000000, "mb megabyte"],
  ["data", "GB", 1000000000, "gb gigabyte"],
  ["data", "TB", 1000000000000, "tb terabyte"],
  ["data", "KiB", 1024, "kib kibibyte"],
  ["data", "MiB", 1048576, "mib mebibyte"],
  ["data", "GiB", 1073741824, "gib gibibyte"],
  ["data", "TiB", 1099511627776, "tib tebibyte"],
  ["speed", "m/s", 1, "m/s mps"],
  ["speed", "km/h", 1 / 3.6, "km/h kmh kph kmph"],
  ["speed", "mph", 0.44704, "mph"],
  ["speed", "kn", 0.514444, "kn kt knot"],
  ["area", "m²", 1, "m2 m² sqm"],
  ["area", "km²", 1000000, "km2 km² sqkm"],
  ["area", "ft²", 0.09290304, "ft2 ft² sqft"],
  ["area", "acre", 4046.8564224, "acre"],
  ["area", "ha", 10000, "ha hectare"],
  ["volume", "ml", 0.001, "ml milliliter millilitre"],
  ["volume", "L", 1, "l liter litre"],
  ["volume", "gal", 3.785411784, "gal gallon"],
  ["volume", "qt", 0.946352946, "qt quart"],
  ["volume", "pt", 0.473176473, "pt pint"],
  ["volume", "cup", 0.2365882365, "cup"],
  ["volume", "fl oz", 0.0295735295625, "floz fluidounce"],
  ["angle", "°", 1, "deg degree °"],
  ["angle", "rad", 180 / Math.PI, "rad radian"],
]

const UNITS = new Map<string, Unit>()

for (const [dimension, symbol, factor, aliases] of TABLE) {
  for (const alias of aliases.split(" ")) {
    UNITS.set(alias, { dimension, symbol, factor })
  }
}

const toCelsius: Record<string, (n: number) => number> = {
  "°C": n => n,
  "°F": n => (n - 32) / 1.8,
  K: n => n - 273.15,
}

const fromCelsius: Record<string, (n: number) => number> = {
  "°C": n => n,
  "°F": n => n * 1.8 + 32,
  K: n => n + 273.15,
}

const lookup = (raw: string) => {
  const key = raw.toLowerCase().replace(/\s/g, "")

  return (
    UNITS.get(key) ?? (key.endsWith("s") ? UNITS.get(key.slice(0, -1)) : null)
  )
}

const QUERY =
  /^([-+]?[\d,]*\.?\d+(?:e[-+]?\d+)?)\s*(\S+(?:\s\S+)?)\s+(?:in|to)\s+(\S+(?:\s\S+)?)$/i

const round = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return 0
  }

  const magnitude = Math.ceil(Math.log10(Math.abs(value)))

  return Number(value.toFixed(Math.max(0, Math.min(6 - magnitude, 12))))
}

const format = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 12 })

const withUnit = (text: string, symbol: string) =>
  symbol.startsWith("°") ? `${text}${symbol}` : `${text} ${symbol}`

export type Conversion = { value: number; unit: string; formatted: string }

export const convert = (query: string): Conversion | null => {
  const match = QUERY.exec(query.trim())

  if (!match) {
    return null
  }

  const amount = parseNumber(match[1])
  const from = lookup(match[2])
  const to = lookup(match[3])

  if (!Number.isFinite(amount) || !from || !to) {
    return null
  }

  if (from.dimension !== to.dimension) {
    return null
  }

  const value =
    from.dimension === "temperature"
      ? fromCelsius[to.symbol](toCelsius[from.symbol](amount))
      : (amount * from.factor) / to.factor
  const rounded = round(value)

  return {
    value: rounded,
    unit: to.symbol,
    formatted: withUnit(format(rounded), to.symbol),
  }
}
