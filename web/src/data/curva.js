// Utilidades de dibujo compartidas por las gráficas del portal.

// Curva suave que no inventa picos ni baja de cero (cúbica monótona de Fritsch–Carlson)
export function curvaSuave(pts) {
  if (pts.length < 2) return ''
  const n = pts.length
  const d = pts.slice(0, -1).map(([x, y], i) => (pts[i + 1][1] - y) / (pts[i + 1][0] - x))
  const m = pts.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const t = a * a + b * b
    if (t > 9) {
      const k = 3 / Math.sqrt(t)
      m[i] = k * a * d[i]
      m[i + 1] = k * b * d[i]
    }
  }
  let ruta = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3
    ruta += ` C${(pts[i][0] + h).toFixed(1)} ${(pts[i][1] + m[i] * h).toFixed(1)}, ${(pts[i + 1][0] - h).toFixed(1)} ${(pts[i + 1][1] - m[i + 1] * h).toFixed(1)}, ${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}`
  }
  return ruta
}
