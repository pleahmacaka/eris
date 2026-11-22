export const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = name
  link.click()
  // the browser reads the URL after this task; revoking it now cancels the download
  setTimeout(() => URL.revokeObjectURL(url))
}
