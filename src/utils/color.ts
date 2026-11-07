/**
 * Convert a hex color value to HSLA
 * @param hex hex color value
 * @param alpha color opacity
 * @returns HSLA or HSL color string
 */
export function hexToHSL(hex: string, alpha: number | null = null): string {
  // Remove the hash at the start if it's there
  hex = hex.replace(/^#/, '')

  // Ensure the input is valid
  if (hex.length !== 6) {
    throw new Error('Invalid HEX color.')
  }

  // Parse the r, g, b values
  let r = Number.parseInt(hex.substring(0, 2), 16)
  let g = Number.parseInt(hex.substring(2, 4), 16)
  let b = Number.parseInt(hex.substring(4, 6), 16)

  // Convert r, g, b to percentages
  r /= 255
  g /= 255
  b /= 255

  // Find the greatest and smallest channel values
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h: number = 0
  let s: number = 0
  let l: number = (max + min) / 2

  // Calculate the hue
  if (max === min) {
    h = s = 0 // achromatic
  }
  else {
    const d = max - min
    s = l > 0.5
      ? d / (2 - max - min)
      : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b
          ? 6
          : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }

    h /= 6
  }

  // Convert to degrees and percentages
  h = Math.round(h * 360)
  s = Math.round(s * 100)
  l = Math.round(l * 100)

  if (alpha !== null)
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`
  return `hsl(${h}, ${s}%, ${l}%)`
}
