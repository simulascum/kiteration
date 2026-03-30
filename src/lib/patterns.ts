export type PatternType =
  | 'none'
  | 'chevrons'
  | 'stripes'
  | 'dots'
  | 'checkerboard'
  | 'diagonal_stripes'
  | 'houndstooth'
  | 'gradient'
  | 'stars'
  | 'crosses'
  | 'zigzag'
  | 'argyle'
  | 'camo'

type PatternDrawFn = (ctx: CanvasRenderingContext2D, size: number, color: string, scale: number) => void

const patterns: Record<Exclude<PatternType, 'none'>, PatternDrawFn> = {
  chevrons(ctx, size, color, scale) {
    ctx.strokeStyle = color
    ctx.lineWidth = 6 * scale
    ctx.lineJoin = 'miter'
    const spacing = 60 * scale, amp = 30 * scale
    for (let y = 0; y < size; y += spacing) {
      ctx.beginPath()
      for (let x = 0; x < size; x += amp * 2) {
        ctx.moveTo(x, y)
        ctx.lineTo(x + amp, y - amp)
        ctx.lineTo(x + amp * 2, y)
      }
      ctx.stroke()
    }
  },

  stripes(ctx, size, color, scale) {
    ctx.fillStyle = color
    const stripeW = 20 * scale, gap = 40 * scale
    for (let x = 0; x < size; x += stripeW + gap) {
      ctx.fillRect(x, 0, stripeW, size)
    }
  },

  dots(ctx, size, color, scale) {
    ctx.fillStyle = color
    const dotR = 8 * scale, spacing = 50 * scale
    for (let y = 0; y < size; y += spacing) {
      const offset = (Math.floor(y / spacing) % 2) * (spacing / 2)
      for (let x = offset; x < size; x += spacing) {
        ctx.beginPath()
        ctx.arc(x, y, dotR, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  },

  checkerboard(ctx, size, color, scale) {
    ctx.fillStyle = color
    const cell = 40 * scale
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        if (((x / cell) + (y / cell)) % 2 < 1) {
          ctx.fillRect(x, y, cell, cell)
        }
      }
    }
  },

  diagonal_stripes(ctx, size, color, scale) {
    ctx.strokeStyle = color
    ctx.lineWidth = 14 * scale
    const gap = 50 * scale
    for (let d = -size; d < size * 2; d += gap) {
      ctx.beginPath()
      ctx.moveTo(d, 0)
      ctx.lineTo(d + size, size)
      ctx.stroke()
    }
  },

  houndstooth(ctx, size, color, scale) {
    ctx.fillStyle = color
    const cell = 40 * scale
    const half = cell / 2
    for (let y = 0; y < size; y += cell) {
      for (let x = 0; x < size; x += cell) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + half, y)
        ctx.lineTo(x, y + half)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x + half, y + half)
        ctx.lineTo(x + cell, y + half)
        ctx.lineTo(x + half, y + cell)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(x + half, y)
        ctx.lineTo(x + cell, y)
        ctx.lineTo(x + cell, y + half)
        ctx.lineTo(x + half, y + half)
        ctx.lineTo(x + half + half / 2, y + half / 2)
        ctx.closePath()
        ctx.fill()
      }
    }
  },

  gradient(ctx, size, color) {
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, color)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
  },

  stars(ctx, size, color, scale) {
    ctx.fillStyle = color
    const spacing = 60 * scale
    const r = 10 * scale
    for (let y = spacing / 2; y < size; y += spacing) {
      const offset = (Math.floor(y / spacing) % 2) * (spacing / 2)
      for (let x = offset + spacing / 2; x < size; x += spacing) {
        drawStar(ctx, x, y, 5, r, r / 2.5)
      }
    }
  },

  crosses(ctx, size, color, scale) {
    ctx.fillStyle = color
    const spacing = 50 * scale
    const arm = 12 * scale
    const thick = 4 * scale
    for (let y = spacing / 2; y < size; y += spacing) {
      for (let x = spacing / 2; x < size; x += spacing) {
        ctx.fillRect(x - arm / 2, y - thick / 2, arm, thick)
        ctx.fillRect(x - thick / 2, y - arm / 2, thick, arm)
      }
    }
  },

  zigzag(ctx, size, color, scale) {
    ctx.fillStyle = color
    const bandH = 30 * scale
    const amp = 15 * scale
    const step = 30 * scale
    for (let y = 0; y < size; y += bandH * 2) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      for (let x = 0; x <= size; x += step) {
        const peak = (x / step) % 2 === 0 ? y : y + amp
        ctx.lineTo(x, peak)
      }
      for (let x = size; x >= 0; x -= step) {
        const peak = (x / step) % 2 === 0 ? y + bandH : y + bandH + amp
        ctx.lineTo(x, peak)
      }
      ctx.closePath()
      ctx.fill()
    }
  },

  argyle(ctx, size, color, scale) {
    ctx.fillStyle = color
    const cellW = 60 * scale
    const cellH = 80 * scale
    for (let y = 0; y < size; y += cellH) {
      for (let x = 0; x < size; x += cellW) {
        const cx = x + cellW / 2
        const cy = y + cellH / 2
        ctx.beginPath()
        ctx.moveTo(cx, y)
        ctx.lineTo(x + cellW, cy)
        ctx.lineTo(cx, y + cellH)
        ctx.lineTo(x, cy)
        ctx.closePath()
        ctx.fill()
      }
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 2 * scale
    ctx.globalAlpha *= 0.4
    for (let d = -size; d < size * 2; d += cellW) {
      ctx.beginPath()
      ctx.moveTo(d, 0)
      ctx.lineTo(d + size, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(d + size, 0)
      ctx.lineTo(d, size)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },

  camo(ctx, size, color, scale) {
    let seed = 12345
    const rand = () => {
      seed = (seed * 16807 + 0) % 2147483647
      return seed / 2147483647
    }
    ctx.fillStyle = color
    const count = Math.floor((size * size) / (3000 * scale * scale))
    for (let i = 0; i < count; i++) {
      const cx = rand() * size
      const cy = rand() * size
      const rx = (20 + rand() * 40) * scale
      const ry = (10 + rand() * 25) * scale
      const angle = rand() * Math.PI
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  },
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: number, outer: number, inner: number) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (Math.PI / points) * i - Math.PI / 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  size: number,
  type: Exclude<PatternType, 'none'>,
  color: string,
  scale = 1,
): void {
  const fn = patterns[type]
  if (fn) fn(ctx, size, color, scale)
}
