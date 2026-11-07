/**
 * Compresses and resizes an image file.
 *
 * @param file - The image file to compress and resize.
 * @param maxWidth - The maximum width of the resized image.
 * @param maxHeight - The maximum height of the resized image.
 * @param quality - The quality of the compressed image (0-1).
 * @param callback - The callback function to execute with the compressed file.
 */
export function compressAndResizeImage(file: File, maxWidth: number, maxHeight: number, quality: number, callback: any) {
  // Create an Image object
  const img = new Image()

  // Create a FileReader to read the file
  const reader = new FileReader()
  reader.onload = function (e) {
    img.src = e.target?.result as string

    img.onload = function () {
      // Create a canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Calculate new size
      let width = img.width
      let height = img.height

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width)
          width = maxWidth
        }
      }
      else {
        if (height > maxHeight) {
          width = Math.round(width * maxHeight / height)
          height = maxHeight
        }
      }

      // Set canvas dimensions
      canvas.width = width
      canvas.height = height

      if (!ctx) {
        console.error('compressAndResizeImage => ctx is null')
        return
      }

      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0, width, height)

      // Compress the image
      canvas.toBlob((blob) => {
        // Create a new blob file
        const compressedFile = new File([blob as Blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })

        // Execute the callback with the new compressed file
        callback(compressedFile)
      }, 'image/jpeg', quality)
    }
  }

  // Read the file as a Data URL (base64)
  reader.readAsDataURL(file)
}

/**
 * Promise version of {@link compressAndResizeImage}
 */
export function compressAndResizeImageAsync(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number,
): Promise<File> {
  return new Promise((resolve) => {
    compressAndResizeImage(file, maxWidth, maxHeight, quality, (compressed: File) => resolve(compressed))
  })
}
