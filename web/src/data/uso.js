// Sección "Uso por app": totales, comparación con el periodo anterior, categorías y mapa de calor día × hora.
import { api } from '../api.js'
import { GRUPO_CATEGORIA, NOMBRE_CATEGORIA, etiquetaCategoria } from './ajustes.js'
import { PERIODOS, fechaISO } from './panel.js'

const DIA_MS = 86_400_000
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
// Minutos por hora desde los que una celda sube de nivel (nivel 5 = 48+ min)
const UMBRALES = [0, 8, 16, 28, 48]

const diaSemana = (d) => (d.getDay() + 6) % 7   // 0 = lunes

export function rangoTexto(desde, hasta) {
  const a = new Date(`${desde}T00:00:00`)
  const b = new Date(`${hasta}T00:00:00`)
  if (desde === hasta) return `${b.getDate()} DE ${MESES[b.getMonth()]}`.toUpperCase()
  const mismoMes = a.getMonth() === b.getMonth()
  return `${a.getDate()}${mismoMes ? '' : ` DE ${MESES[a.getMonth()]}`} AL ${b.getDate()} DE ${MESES[b.getMonth()]}`.toUpperCase()
}

// Eventos del periodo inmediatamente anterior (para las flechas de comparación). En la demo no hay.
export async function cargarAnterior(usuario, desde, hasta) {
  if (usuario.demo) return null
  const dias = Math.round((new Date(`${hasta}T00:00:00`) - new Date(`${desde}T00:00:00`)) / DIA_MS) + 1
  const fin = new Date(new Date(`${desde}T00:00:00`).getTime() - DIA_MS)
  const inicio = new Date(fin.getTime() - (dias - 1) * DIA_MS)
  return api.eventos(usuario.id, `${fechaISO(inicio)}T00:00:00`, `${fechaISO(fin)}T23:59:59`)
}

// Reparte la duración de cada evento entre las horas que abarca
function porHora(eventos) {
  const celdas = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const e of eventos) {
    let t = new Date(e.inicio).getTime()
    const fin = Math.max(t + 60_000, new Date(e.fin).getTime())
    while (t < fin) {
      const d = new Date(t)
      const finHora = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
      const tramo = Math.min(fin, finHora) - t
      celdas[diaSemana(d)][d.getHours()] += tramo / 60_000
      t += tramo
    }
  }
  return celdas
}

const cambioPct = (actual, anterior) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : null)

export function construirUso(datos, anteriores) {
  const { eventos, apps, desde, hasta } = datos
  const dias = Math.round((new Date(`${hasta}T00:00:00`) - new Date(`${desde}T00:00:00`)) / DIA_MS) + 1
  const enRango = eventos.filter((e) => {
    const f = fechaISO(new Date(e.inicio))
    return f >= desde && f <= hasta
  })
  const minutos = (lista) => lista.reduce((s, e) => s + e.duracion_seg, 0) / 60
  const total = minutos(enRango)
  const totalAnterior = anteriores ? minutos(anteriores) : null

  const porApp = apps.map((app) => {
    const min = minutos(enRango.filter((e) => e.app_numero === app.numero))
    const antes = anteriores ? minutos(anteriores.filter((e) => e.app_numero === app.numero)) : null
    return { ...app, min, etiqueta: etiquetaCategoria(app.categoria), cambio: antes == null ? null : cambioPct(min, antes) }
  }).filter((a) => a.min > 0).sort((a, b) => b.min - a.min)

  const grupos = {}
  for (const a of porApp) {
    const g = GRUPO_CATEGORIA(a.categoria) ?? 'otros'
    grupos[g] = (grupos[g] ?? 0) + a.min
  }
  const categorias = Object.entries(grupos)
    .map(([g, min]) => ({ id: g, nombre: NOMBRE_CATEGORIA[g] ?? 'Otras', min, pct: total ? min / total : 0 }))
    .sort((a, b) => b.min - a.min)

  // Mapa de calor: con más de una semana se promedia por día de la semana
  const semanas = Math.max(1, dias / 7)
  const celdas = porHora(enRango).map((fila) => fila.map((m) => m / semanas))
  const nivel = (m) => (m <= 0 ? 0 : UMBRALES.filter((u) => m > u).length)
  const lista = celdas.flatMap((fila, d) => fila.map((min, h) => ({ d, h, min })))
  const picos = [...lista].sort((a, b) => b.min - a.min).filter((c) => c.min > 0).slice(0, 3)

  // Franja más crítica: las 3 horas seguidas con más uso (pueden cruzar la medianoche)
  const porHoraTotal = Array.from({ length: 24 }, (_, h) => celdas.reduce((s, fila) => s + fila[h], 0))
  let inicioFranja = 0
  let mejor = -1
  for (let h = 0; h < 24; h++) {
    const suma = porHoraTotal[h] + porHoraTotal[(h + 1) % 24] + porHoraTotal[(h + 2) % 24]
    if (suma > mejor) {
      mejor = suma
      inicioFranja = h
    }
  }
  const horasFranja = [0, 1, 2].map((k) => (inicioFranja + k) % 24)
  const porDiaFranja = celdas.map((fila, d) => ({ d, min: horasFranja.reduce((s, h) => s + fila[h], 0) }))
  const porMagnitud = [...porDiaFranja].sort((a, b) => b.min - a.min).filter((x) => x.min > 0).map((x) => x.d)
  const diasFranja = porMagnitud.slice(0, 3).sort((a, b) => a - b)
  const diasTop2 = porMagnitud.slice(0, 2).sort((a, b) => a - b)
  const hora = (h) => `${String(h).padStart(2, '0')}:00`

  return {
    dias,
    total,
    cambioTotal: totalAnterior == null ? null : cambioPct(total, totalAnterior),
    promedio: total / dias,
    apps: porApp,
    categorias,
    celdas: celdas.map((fila) => fila.map((min) => ({ min, nivel: nivel(min) }))),
    pico: picos[0] ?? null,
    picos: picos.map((c) => ({ ...c, texto: `${DIAS_LARGOS[c.d][0].toUpperCase()}${DIAS_LARGOS[c.d].slice(1)} · ${hora(c.h)}` })),
    franja: mejor > 0 ? {
      texto: `${hora(inicioFranja)}–${hora((inicioFranja + 3) % 24)}`,
      dias: diasFranja,
      principales: diasTop2.map((d) => DIAS_LARGOS[d]),
      desde: hora(inicioFranja),
      hasta: hora((inicioFranja + 3) % 24),
    } : null,
  }
}

export const listaDias = (dias) => (dias.length <= 1 ? dias.join('') : `${dias.slice(0, -1).join(', ')} y ${dias[dias.length - 1]}`)

// "de jueves a sábado" si los días son seguidos; si no, "los martes, miércoles y sábado"
export function rangoDias(indices) {
  const nombres = indices.map((d) => DIAS_LARGOS[d])
  const seguidos = indices.every((d, i) => i === 0 || d === indices[i - 1] + 1)
  return indices.length >= 3 && seguidos ? `de ${nombres[0]} a ${nombres[nombres.length - 1]}` : `los ${listaDias(nombres)}`
}

export const PERIODOS_USO = PERIODOS.map((p) => ({
  id: p.id,
  titulo: { hoy: 'Hoy', '7d': '7 días', '30d': '30 días', semestre: 'Semestre' }[p.id] ?? p.etiqueta,
}))
