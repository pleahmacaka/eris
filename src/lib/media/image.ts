export const measureImage = async (file: Blob) => {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }

    bitmap.close()

    return size
  } catch {
    return null
  }
}
