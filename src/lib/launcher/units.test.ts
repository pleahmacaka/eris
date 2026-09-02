import { describe, expect, test } from "bun:test"
import { convert } from "./units"

const formatted = (query: string) => convert(query)?.formatted ?? null

describe("convert", () => {
  test("length", () => {
    expect(formatted("10 km in miles")).toBe("6.21371 mi")
    expect(formatted("12 in to cm")).toBe("30.48 cm")
    expect(formatted("6 feet in m")).toBe("1.8288 m")
  })

  test("temperature", () => {
    expect(formatted("72f to c")).toBe("22.2222°C")
    expect(formatted("100 c to f")).toBe("212°F")
    expect(formatted("0 c in k")).toBe("273.15 K")
  })

  test("time, mass, data, speed", () => {
    expect(formatted("3 hours in minutes")).toBe("180 min")
    expect(formatted("45 kg to lb")).toBe("99.208 lb")
    expect(formatted("1.5 GB in MB")).toBe("1,500 MB")
    expect(formatted("1 gib in mib")).toBe("1,024 MiB")
    expect(formatted("100 km/h in mph")).toBe("62.1371 mph")
  })

  test("area, volume, angle", () => {
    expect(formatted("2 ha in m2")).toBe("20,000 m²")
    expect(formatted("1 gal to l")).toBe("3.78541 L")
    expect(formatted("180 deg in rad")).toBe("3.14159 rad")
    expect(formatted("1 rad to deg")).toBe("57.2958°")
  })

  test("case and plural insensitive", () => {
    expect(convert("10 KM IN MILES")?.value).toBe(6.21371)
    expect(convert("2 metres to centimetres")?.value).toBe(200)
  })

  test("a bare trailing in is a separator only when a unit follows", () => {
    expect(convert("10 cm in in")?.formatted).toBe("3.93701 in")
    expect(convert("10 km in")).toBeNull()
    expect(convert("10 in")).toBeNull()
  })

  test("rejects mismatched dimensions and non-conversions", () => {
    expect(convert("1 t in b")).toBeNull()
    expect(convert("10 km in bananas")).toBeNull()
    expect(convert("2 + 2")).toBeNull()
    expect(convert("chrome")).toBeNull()
    expect(convert("")).toBeNull()
  })

  test("accepts the degree symbol it prints", () => {
    expect(formatted("72°f to c")).toBe("22.2222°C")
    expect(formatted("22.2222°C to f")).toBe("72°F")
    expect(formatted("180° in rad")).toBe("3.14159 rad")
    expect(formatted("1 rad to °")).toBe("57.2958°")
  })

  test("units may be two words", () => {
    expect(formatted("8 fl oz in ml")).toBe("236.588 ml")
    expect(formatted("3 fluid ounces to ml")).toBe("88.7206 ml")
    expect(formatted("1 nautical mile in km")).toBe("1.852 km")
  })

  test("binary and nautical siblings", () => {
    expect(formatted("1 tb in tib")).toBe("0.909495 TiB")
    expect(formatted("5 tib in gib")).toBe("5,120 GiB")
    expect(formatted("1 nmi in m")).toBe("1,852 m")
  })

  test("a decimal comma is not a thousands separator", () => {
    expect(convert("1,5 km in m")).toBeNull()
  })

  test("keeps thousands readable", () => {
    expect(formatted("1,000 m in km")).toBe("1 km")
    expect(formatted("5 tb to gb")).toBe("5,000 GB")
  })
})
