const pad = (n: number) => String(n).padStart(2, "0")

export const fillTemplate = (text: string, title: string, now = new Date()) => {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  return text
    .replaceAll("{{title}}", title)
    .replaceAll("{{date}}", date)
    .replaceAll("{{time}}", time)
}
