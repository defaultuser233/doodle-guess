import { PAPER_COLOR } from './drawing'

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadArtwork(image: string, filename: string): Promise<void> {
  return new Promise((resolve) => {
    const picture = new Image()
    picture.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const context = canvas.getContext('2d')
      if (!context) {
        resolve()
        return
      }
      context.fillStyle = PAPER_COLOR
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(picture, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve()
          return
        }
        const url = URL.createObjectURL(blob)
        triggerDownload(url, filename)
        window.setTimeout(() => URL.revokeObjectURL(url), 4000)
        resolve()
      }, 'image/png')
    }
    picture.onerror = () => resolve()
    picture.src = image
  })
}
