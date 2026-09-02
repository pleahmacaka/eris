import { describe, expect, test } from "bun:test"
import { openTarget, score } from "./search"

describe("ranking", () => {
  test("whole-word match on a short title beats prefix on a longer one", () => {
    expect(score("Google Chrome", "chrome")).toBeGreaterThan(
      score("Chrome Remote Desktop", "chrome"),
    )
    expect(score("Google Chrome", "chrome")).toBeGreaterThan(
      score("Chrome Remote Desktop Host", "chrome"),
    )
  })

  test("initials beat a substring buried inside a word", () => {
    expect(score("Windows PowerShell", "ps")).toBeGreaterThan(
      score("Apps", "ps"),
    )
    expect(score("KakaoTalk", "kt")).toBeGreaterThan(
      score("Chrome Remote Desktop", "kt"),
    )
  })

  test("later query letters prefer word starts over the earliest hit", () => {
    expect(score("Visual Studio", "vs")).toBeGreaterThan(score("Vessel", "vs"))
    expect(score("Visual Studio Code", "vsc")).toBeGreaterThan(
      score("Visual Studio Code", "vic"),
    )
  })

  test("file names are not web targets", () => {
    expect(openTarget("chrome.exe")).toBeNull()
    expect(openTarget("settings.json")).toBeNull()
    expect(openTarget("node.js")).toBeNull()
    expect(openTarget("github.com")).toBe("https://github.com")
    expect(openTarget("https://chrome.exe")).toBe("https://chrome.exe")
  })

  test("acronyms sit between word starts and buried substrings", () => {
    expect(score("Windows PowerShell", "wps")).toBeGreaterThan(
      score("Chrome Remote Desktop", "wps"),
    )
    expect(score("Visual Studio Code", "vsc")).toBeLessThan(
      score("VSCode Insiders", "vsc"),
    )
    expect(score("Visual Studio Code", "vsc")).toBeGreaterThan(
      score("Advanced System Care", "vsc"),
    )
    expect(score("Visual Studio Code", "vsl")).toBeGreaterThan(0)
  })

  test("korean choseong ranks like latin tiers", () => {
    expect(score("카카오톡", "ㅋㅋㅇㅌ")).toBeGreaterThan(
      score("카카오톡 KakaoTalk", "ㅋㅋㅇㅌ"),
    )
    expect(score("카카오톡", "ㅋㅋ")).toBeGreaterThan(score("카카오톡", "ㅇㅌ"))
    expect(score("카카오톡", "ㅇㅌ")).toBeGreaterThan(score("카카오톡", "ㅋㅌ"))
    expect(score("카카오톡", "ㅋㅌ")).toBeGreaterThan(0)
    expect(score("메모장", "ㅋㅌ")).toBe(0)
    expect(score("네이버 웨일", "ㄴㅇㅂㅇㅇ")).toBeGreaterThan(
      score("네이버 웨일", "ㅇㅇ"),
    )
  })
})
