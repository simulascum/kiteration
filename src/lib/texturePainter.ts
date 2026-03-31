import type { UVIslandData } from './uvIslands.ts'
import { DEBUG_ISLAND_COLORS } from '../components/Jersey'
import type { ZoneConfig, OverlayOptions } from '../components/Jersey'
import { drawPattern, type PatternType } from './patterns'
export type { PatternType } from './patterns'

const TEX_SIZE = 2048

export interface NumberOptions {
  text: string
  color: string
  zone: string
  scale: number
}

export interface DecalOptions {
  image: HTMLImageElement
  color: string
  scale: number
  vertOffset: number
  frontIslandId: number
}

export interface ChestIconOptions {
  image: HTMLImageElement
  scale: number       // percentage of zone height
  xOffset: number     // -1 to 1, horizontal offset from center
  yOffset: number     // -1 to 1, vertical offset from center (positive = up in texture space)
  color?: string      // optional tint color (replaces all opaque pixels)
}

/**
 * Manages an offscreen canvas texture for painting zone colors,
 * patterns, decals, and numbers onto a UV-mapped mesh.
 */
export class TexturePainter {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly size: number

  constructor(size = TEX_SIZE) {
    this.size = size
    this.canvas = document.createElement('canvas')
    this.canvas.width = size
    this.canvas.height = size
    this.ctx = this.canvas.getContext('2d')!
  }

  paint(
    data: UVIslandData,
    islandToZone: Record<number, string>,
    zoneConfigs: Record<string, ZoneConfig>,
    overlays?: OverlayOptions,
  ): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    // Clear
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)

    // Fill triangles per zone
    for (let t = 0; t < triCount; t++) {
      const zone = islandToZone[triToIsland[t]]
      const color = zone ? (zoneConfigs[zone]?.color ?? '#333') : '#333'

      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(uvs.getX(i0) * size, uvs.getY(i0) * size)
      ctx.lineTo(uvs.getX(i1) * size, uvs.getY(i1) * size)
      ctx.lineTo(uvs.getX(i2) * size, uvs.getY(i2) * size)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    // Per-zone pattern overlays
    for (const [zone, cfg] of Object.entries(zoneConfigs)) {
      if (cfg.pattern && cfg.pattern !== 'none') {
        this.drawPattern(data, islandToZone, zone, cfg.pattern, cfg.patternColor ?? '#ffffff', cfg.patternScale ?? 1, cfg.patternOpacity ?? 1)
      }
    }

    // Decal
    if (overlays?.decal) {
      this.drawDecal(data, overlays.decal)
    }

    // Chest icon
    if (overlays?.chestIcon) {
      this.drawChestIcon(data, islandToZone, overlays.chestIcon)
    }

    // Number
    if (overlays?.number && overlays.number.text.trim()) {
      this.drawNumber(data, islandToZone, overlays.number)
    }
  }

  private drawPattern(
    data: UVIslandData,
    islandToZone: Record<number, string>,
    zone: string,
    type: Exclude<PatternType, 'none'>,
    color: string,
    scale: number,
    opacity: number,
  ): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    ctx.save()
    ctx.globalAlpha = opacity
    ctx.beginPath()
    for (let t = 0; t < triCount; t++) {
      if (islandToZone[triToIsland[t]] !== zone) continue
      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2
      ctx.moveTo(uvs.getX(i0) * size, uvs.getY(i0) * size)
      ctx.lineTo(uvs.getX(i1) * size, uvs.getY(i1) * size)
      ctx.lineTo(uvs.getX(i2) * size, uvs.getY(i2) * size)
    }
    ctx.clip()

    drawPattern(ctx, size, type, color, scale)
    ctx.restore()
  }

  private drawDecal(data: UVIslandData, decal: DecalOptions): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    // Compute island bounding box
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (let t = 0; t < triCount; t++) {
      if (triToIsland[t] !== decal.frontIslandId) continue
      for (let j = 0; j < 3; j++) {
        const vi = index ? index.getX(t * 3 + j) : t * 3 + j
        const u = uvs.getX(vi), v = uvs.getY(vi)
        minU = Math.min(minU, u); maxU = Math.max(maxU, u)
        minV = Math.min(minV, v); maxV = Math.max(maxV, v)
      }
    }

    const centerU = ((minU + maxU) / 2) * size
    const centerV = ((minV + maxV) / 2) * size
    const zoneH = (maxV - minV) * size
    const vertOffset = zoneH * decal.vertOffset
    const drawH = zoneH * (decal.scale / 100)
    const drawW = drawH * (decal.image.width / decal.image.height)

    // Tint
    const tmp = document.createElement('canvas')
    tmp.width = decal.image.width
    tmp.height = decal.image.height
    const tc = tmp.getContext('2d')!
    tc.drawImage(decal.image, 0, 0)
    tc.globalCompositeOperation = 'source-in'
    tc.fillStyle = decal.color
    tc.fillRect(0, 0, tmp.width, tmp.height)

    ctx.save()
    ctx.translate(centerU, centerV + vertOffset)
    ctx.scale(1, -1)
    ctx.drawImage(tmp, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }

  private drawChestIcon(
    data: UVIslandData,
    islandToZone: Record<number, string>,
    icon: ChestIconOptions,
  ): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    // Find the island ID for the 'front' zone
    let targetIsland = -1
    for (const [id, zone] of Object.entries(islandToZone)) {
      if (zone === 'front') { targetIsland = Number(id); break }
    }
    if (targetIsland === -1) return

    // Compute island bounding box
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (let t = 0; t < triCount; t++) {
      if (triToIsland[t] !== targetIsland) continue
      for (let j = 0; j < 3; j++) {
        const vi = index ? index.getX(t * 3 + j) : t * 3 + j
        const u = uvs.getX(vi), v = uvs.getY(vi)
        minU = Math.min(minU, u); maxU = Math.max(maxU, u)
        minV = Math.min(minV, v); maxV = Math.max(maxV, v)
      }
    }

    const zoneW = (maxU - minU) * size
    const zoneH = (maxV - minV) * size
    const centerU = ((minU + maxU) / 2) * size
    const centerV = ((minV + maxV) / 2) * size

    // Position: offset from center of zone
    const drawX = centerU + icon.xOffset * (zoneW / 2)
    const drawY = centerV + icon.yOffset * (zoneH / 2)

    const drawH = zoneH * (icon.scale / 100)
    const drawW = drawH * (icon.image.width / icon.image.height)

    // Optionally tint the image
    let src: CanvasImageSource = icon.image
    if (icon.color) {
      const tmp = document.createElement('canvas')
      tmp.width = icon.image.width
      tmp.height = icon.image.height
      const tc = tmp.getContext('2d')!
      tc.drawImage(icon.image, 0, 0)
      tc.globalCompositeOperation = 'source-in'
      tc.fillStyle = icon.color
      tc.fillRect(0, 0, tmp.width, tmp.height)
      src = tmp
    }

    ctx.save()
    ctx.translate(drawX, drawY)
    ctx.scale(1, -1)
    ctx.drawImage(src, -drawW / 2, -drawH / 2, drawW, drawH)
    ctx.restore()
  }

  private drawNumber(
    data: UVIslandData,
    islandToZone: Record<number, string>,
    num: NumberOptions,
  ): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    // Find the island ID for the target zone
    let targetIsland = -1
    for (const [id, zone] of Object.entries(islandToZone)) {
      if (zone === num.zone) { targetIsland = Number(id); break }
    }
    if (targetIsland === -1) return

    // Compute island bounding box
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (let t = 0; t < triCount; t++) {
      if (triToIsland[t] !== targetIsland) continue
      for (let j = 0; j < 3; j++) {
        const vi = index ? index.getX(t * 3 + j) : t * 3 + j
        const u = uvs.getX(vi), v = uvs.getY(vi)
        minU = Math.min(minU, u); maxU = Math.max(maxU, u)
        minV = Math.min(minV, v); maxV = Math.max(maxV, v)
      }
    }

    const centerX = ((minU + maxU) / 2) * size
    const centerY = ((minV + maxV) / 2) * size
    const zoneH = (maxV - minV) * size
    const fontSize = Math.round(zoneH * (num.scale / 100))

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.scale(1, -1)
    ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = num.color
    ctx.fillText(num.text, 0, 0)
    ctx.restore()
  }

  /** Paint each UV island a unique hue for debugging */
  paintDebug(data: UVIslandData): void {
    const { ctx, size } = this
    const { triToIsland, triCount, uvs, index } = data

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, size, size)

    for (let t = 0; t < triCount; t++) {
      const islandId = triToIsland[t]
      const color = DEBUG_ISLAND_COLORS[islandId] ?? '#666666'

      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(uvs.getX(i0) * size, uvs.getY(i0) * size)
      ctx.lineTo(uvs.getX(i1) * size, uvs.getY(i1) * size)
      ctx.lineTo(uvs.getX(i2) * size, uvs.getY(i2) * size)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }

  /** Export a PNG UV debug map with island labels (e.g. #0, #1). */
  downloadDebugMap(data: UVIslandData, filename = 'uv-debug-map.png'): void {
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = this.size
    exportCanvas.height = this.size
    const exportCtx = exportCanvas.getContext('2d')
    if (!exportCtx) return

    const { size } = this
    const { triToIsland, triCount, uvs, index } = data

    exportCtx.fillStyle = '#000'
    exportCtx.fillRect(0, 0, size, size)

    const islandBounds = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>()

    for (let t = 0; t < triCount; t++) {
      const islandId = triToIsland[t]
      const color = DEBUG_ISLAND_COLORS[islandId] ?? '#666666'

      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

      const x0 = uvs.getX(i0) * size
      const y0 = uvs.getY(i0) * size
      const x1 = uvs.getX(i1) * size
      const y1 = uvs.getY(i1) * size
      const x2 = uvs.getX(i2) * size
      const y2 = uvs.getY(i2) * size

      const prev = islandBounds.get(islandId)
      if (!prev) {
        islandBounds.set(islandId, {
          minX: Math.min(x0, x1, x2),
          minY: Math.min(y0, y1, y2),
          maxX: Math.max(x0, x1, x2),
          maxY: Math.max(y0, y1, y2),
        })
      } else {
        prev.minX = Math.min(prev.minX, x0, x1, x2)
        prev.minY = Math.min(prev.minY, y0, y1, y2)
        prev.maxX = Math.max(prev.maxX, x0, x1, x2)
        prev.maxY = Math.max(prev.maxY, y0, y1, y2)
      }

      exportCtx.fillStyle = color
      exportCtx.strokeStyle = color
      exportCtx.lineWidth = 2
      exportCtx.beginPath()
      exportCtx.moveTo(x0, y0)
      exportCtx.lineTo(x1, y1)
      exportCtx.lineTo(x2, y2)
      exportCtx.closePath()
      exportCtx.fill()
      exportCtx.stroke()
    }

    const fontSize = Math.max(22, Math.round(size * 0.03))
    exportCtx.font = `bold ${fontSize}px monospace`
    exportCtx.textAlign = 'center'
    exportCtx.textBaseline = 'middle'

    for (const [islandId, bounds] of islandBounds.entries()) {
      const label = `#${islandId}`
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      const textWidth = exportCtx.measureText(label).width
      const padX = 8
      const padY = 6
      const w = textWidth + padX * 2
      const h = fontSize + padY * 2

      exportCtx.fillStyle = '#000'
      exportCtx.fillRect(cx - w / 2, cy - h / 2, w, h)

      exportCtx.fillStyle = '#fff'
      exportCtx.fillText(label, cx, cy)
    }

    const link = document.createElement('a')
    link.href = exportCanvas.toDataURL('image/png')
    link.download = filename
    link.click()
  }
}
