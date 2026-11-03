// Sección "Reportes" (Figma e36–e37): un resumen por cada semana cerrada del plan y la exportación de métricas.
// Todo sale de lo que ya da la API (plan, ajustes, eventos, pausas y riesgo); no hay rutas nuevas.
import { api } from '../api.js'
import { datosDemo } from './demo.js'
import { fechaISO } from './panel.js'
import { horas, ordenar } from './plan.js'
import { FACTORES, MODELO, ALTO, cargarRiesgo } from './riesgo.js'
import { construirUso, rangoDias } from './uso.js'

const DIA_MS = 86_400_000
const SEMANA_MS = 7 * DIA_MS
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const nivelDe = (p) => (p == null ? null : p < MODELO.umbral ? 'bajo' : p < ALTO ? 'medio' : 'alto')
const signo = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

// "12 al 18 de mayo" o "28 abr al 4 de mayo"
export function rango(a, b) {
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `${a.getDate()} ${MESES_CORTOS[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`
}
export const fechaCorta = (d) => `${d.getDate()} de ${MESES[d.getMonth()]}`
const fechaConDia = (d) => `${DIAS_LARGOS[d.getDay()]} ${fechaCorta(d)}`

// ---------- Carga ----------

// Plan de demostración de 6 semanas; la adherencia se calcula con los eventos de la demo
function demo() {
  const base = datosDemo('semestre')
  const hoy = new Date()
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7))
  const inicio = new Date(lunes.getTime() - 6 * SEMANA_MS)
  const plan = { numero: 1, fecha_inicio: fechaISO(inicio), limite_base: 210, semana_actual: 7, activo: true }
  const ajustes = [
    { semana: 1, cambio_pct: 4.2 },
    { semana: 2, cambio_pct: 0 },
    { semana: 3, cambio_pct: -3.1 },
    { semana: 4, cambio_pct: 0 },
    { semana: 5, cambio_pct: -5.9 },
    { semana: 6, cambio_pct: -5.9 },
  ].map((a) => ({ ...a, adherencia: null, uso_meta: null, fecha: fechaISO(new Date(inicio.getTime() + a.semana * SEMANA_MS)) }))
  return {
    plan, ajustes, apps: base.apps, eventos: base.eventos, pausas: base.pausas,
    riesgo: {
      nivel: 'medio', probabilidad: 0.48,
      factores: [{ variable: 'pct_nocturno', valor: 0.31, efecto: 'sube' }],
      historial: [0.63, 0.58, 0.49, 0.55, 0.45, 0.48].map((p, i) => ({ semana: i + 1, probabilidad: p })),
    },
  }
}

export async function cargarReportes(usuario, datos) {
  if (usuario.demo) return demo()
  const plan = datos?.plan
  if (!plan) return { plan: null }
  const desde = new Date(new Date(`${plan.fecha_inicio}T00:00:00`).getTime() - SEMANA_MS)
  const [eventos, pausas, riesgo] = await Promise.all([
    api.eventos(usuario.id, `${fechaISO(desde)}T00:00:00`, undefined),
    api.pausas(usuario.id),
    cargarRiesgo(usuario).catch(() => null),
  ])
  return { plan, ajustes: datos.ajustes ?? [], apps: datos.apps ?? [], eventos, pausas, riesgo }
}

// ---------- Semanas ----------

function minutosPorDia(eventos, desde) {
  const dias = Array(7).fill(0)
  for (const e of eventos) {
    const k = Math.floor((new Date(e.inicio) - desde) / DIA_MS)
    if (k >= 0 && k < 7) dias[k] += e.duracion_seg / 60
  }
  return dias
}

function enSemana(lista, desde, campo) {
  const a = desde.getTime()
  return lista.filter((x) => {
    const t = new Date(x[campo]).getTime()
    return t >= a && t < a + SEMANA_MS
  })
}

// Semanas cerradas del plan (la más reciente primero) más la semana anterior al plan si tiene uso
export function construirSemanas(r, ahora = new Date()) {
  const inicio = new Date(`${r.plan.fecha_inicio}T00:00:00`)
  const cerradas = Math.max(0, Math.floor((ahora - inicio) / SEMANA_MS))
  const ajustes = ordenar(r.ajustes)
  const historial = Object.fromEntries((r.riesgo?.historial ?? []).map((h) => [h.semana, h.probabilidad]))
  const lista = []
  let anterior = null
  for (let s = 0; s <= cerradas; s++) {
    const desde = new Date(inicio.getTime() + (s - 1) * SEMANA_MS)
    const hasta = new Date(desde.getTime() + 6 * DIA_MS)
    const eventos = enSemana(r.eventos, desde, 'inicio')
    if (s === 0 && !eventos.length) continue
    const dias = minutosPorDia(eventos, desde)
    const promedio = dias.reduce((t, m) => t + m, 0) / 7
    // Límite de esa semana: el base con los ajustes de las semanas anteriores
    const limite = s ? ajustes.filter((a) => a.semana < s).reduce((l, a) => l * (1 + a.cambio_pct / 100), r.plan.limite_base) : null
    const ajuste = ajustes.find((a) => a.semana === s) ?? null
    const probabilidad = s ? historial[s] ?? null : null
    lista.push({
      id: s,
      semana: s,
      desde, hasta,
      titulo: rango(desde, hasta),
      antesDelPlan: s === 0,
      eventos,
      pausas: enSemana(r.pausas ?? [], desde, 'fecha'),
      dias: dias.map((min, i) => ({ etiqueta: DIAS[i], min, excede: limite != null && min > limite })),
      promedio,
      cambioUso: anterior?.promedio > 0 ? Math.round(((promedio - anterior.promedio) / anterior.promedio) * 100) : null,
      limite,
      diasDentro: limite == null ? null : dias.filter((m) => m <= limite).length,
      adherencia: ajuste?.adherencia ?? (limite == null ? null : dias.filter((m) => m <= limite).length / 7),
      cambioPlan: ajuste?.cambio_pct ?? null,
      nuevoLimite: ajuste && limite != null ? limite * (1 + ajuste.cambio_pct / 100) : null,
      probabilidad,
      nivel: nivelDe(probabilidad),
      // Se "escribe" el lunes siguiente a las 08:00
      escrito: new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + 1, 8),
    })
    anterior = lista[lista.length - 1]
  }
  return lista.reverse()
}

export function subtitulo(s) {
  if (s.antesDelPlan) return `Antes del plan · ${horas(s.promedio)}`
  if (s.semana === 1 && s.nivel == null) return 'Semana inicial · sin riesgo'
  return `${horas(s.promedio)}${s.nivel ? ` · riesgo ${s.nivel}` : ''}`
}

// Texto del resumen con los mismos datos que recibe Foqui (totales, adherencia, cambio y riesgo)
export function textoResumen(s, r, nombre, esUltima) {
  const parrafos = []
  const compara = s.cambioUso == null ? '' : `, ${Math.abs(s.cambioUso)} % ${s.cambioUso <= 0 ? 'menos' : 'más'} que la anterior`
  if (s.antesDelPlan) {
    parrafos.push(`¡Hola, ${nombre}! Esta es la semana antes de empezar tu plan: usaste el celular ${horas(s.promedio)} al día. Con este punto de partida se calculó tu primer límite.`)
    return parrafos
  }
  const meta = s.diasDentro != null ? ` y cumpliste tu meta ${s.diasDentro} de 7 días` : ''
  parrafos.push(`¡Hola, ${nombre}! Esta semana usaste el celular ${horas(s.promedio)} al día${compara}${meta}.`)

  const partes = []
  if (s.cambioPlan != null) {
    const nuevo = s.nuevoLimite != null ? ` y queda en ${horas(s.nuevoLimite)} desde el lunes` : ''
    partes.push(s.cambioPlan < 0 ? `Por eso tu límite baja ${Math.abs(s.cambioPlan)} %${nuevo}.`
      : s.cambioPlan > 0 ? `Por eso tu límite se relaja ${s.cambioPlan} %${nuevo}.` : `Tu límite se mantiene igual${nuevo}.`)
  }
  if (s.nivel) {
    const factor = esUltima ? r.riesgo?.factores?.find((f) => f.efecto === 'sube') : null
    const detalle = factor && FACTORES[factor.variable]
      ? `: lo que más lo sube es el ${FACTORES[factor.variable].titulo.toLowerCase()}, que fue ${FACTORES[factor.variable].valor(factor.valor)}`
      : ''
    partes.push(`Tu riesgo está en ${s.nivel} (${Math.round(s.probabilidad * 100)} %)${detalle}.`)
  }
  if (partes.length) parrafos.push(partes.join(' '))

  const uso = s.eventos.length ? construirUso({ eventos: s.eventos, apps: r.apps ?? [], desde: fechaISO(s.desde), hasta: fechaISO(s.hasta) }, null) : null
  if (uso?.franja) {
    parrafos.push(`Para la próxima semana: programa el Modo Foco a las ${uso.franja.desde} ${rangoDias(uso.franja.dias)}, que es cuando más se concentra tu uso.`)
  }
  return parrafos
}

export const escritoTexto = (s) => `Escrito por Foqui el ${fechaConDia(s.escrito)} a las 08:00 · con los números de abajo`

export const kpisSemana = (s) => [
  { etiqueta: 'PROMEDIO DIARIO', valor: horas(s.promedio), detalle: s.cambioUso == null ? 'sin semana anterior' : `${signo(s.cambioUso)} %` },
  { etiqueta: 'ADHERENCIA', valor: s.adherencia == null ? '—' : `${Math.round(s.adherencia * 100)} %`, detalle: s.diasDentro == null ? 'antes del plan' : `${s.diasDentro} de 7 días` },
  { etiqueta: 'AJUSTE', valor: s.cambioPlan == null ? '—' : `${signo(s.cambioPlan)} %`, detalle: s.cambioPlan == null ? 'sin ajuste' : 'según tu semana' },
  { etiqueta: 'RIESGO', valor: s.nivel ? s.nivel[0].toUpperCase() + s.nivel.slice(1) : '—', detalle: s.probabilidad == null ? 'sin riesgo' : `${Math.round(s.probabilidad * 100)} %` },
]

// ---------- Exportar métricas (Figma e37) ----------

export const PERIODOS_EXPORTAR = [
  { id: 'semana', titulo: 'Esta semana' },
  { id: '4s', titulo: '4 semanas' },
  { id: 'plan', titulo: 'Todo el plan' },
  { id: 'personalizado', titulo: 'Personalizado' },
]

export function rangoExportar(periodo, r, personalizado, ahora = new Date()) {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  if (periodo === 'semana') return { desde: new Date(hoy.getTime() - ((hoy.getDay() + 6) % 7) * DIA_MS), hasta: hoy }
  if (periodo === '4s') return { desde: new Date(hoy.getTime() - 27 * DIA_MS), hasta: hoy }
  if (periodo === 'plan') return { desde: new Date(`${r.plan.fecha_inicio}T00:00:00`), hasta: hoy }
  const desde = personalizado.desde ? new Date(`${personalizado.desde}T00:00:00`) : hoy
  const hasta = personalizado.hasta ? new Date(`${personalizado.hasta}T00:00:00`) : hoy
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
}

const dentro = (iso, { desde, hasta }) => {
  const t = new Date(iso).getTime()
  return t >= desde.getTime() && t < hasta.getTime() + DIA_MS
}
const csv = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
const fila = (valores) => valores.map(csv).join(',')

// Secciones que se pueden incluir, con lo que se muestra a la derecha y sus filas
export function seccionesExportar(r, semanas, rangoSel, nombre) {
  const dias = Math.round((rangoSel.hasta - rangoSel.desde) / DIA_MS) + 1
  const app = (n) => r.apps?.find((a) => a.numero === n)?.nombre ?? `App ${n}`
  const eventos = r.eventos.filter((e) => dentro(e.inicio, rangoSel))
  const pausas = (r.pausas ?? []).filter((p) => dentro(p.fecha, rangoSel))
  const enRango = semanas.filter((s) => !s.antesDelPlan && s.hasta >= rangoSel.desde && s.desde <= rangoSel.hasta)

  const porDiaApp = {}
  for (const e of eventos) {
    const k = `${fechaISO(new Date(e.inicio))}|${e.app_numero}`
    porDiaApp[k] ??= { min: 0, aperturas: 0 }
    porDiaApp[k].min += e.duracion_seg / 60
    porDiaApp[k].aperturas += 1
  }
  return [
    {
      id: 'uso', titulo: 'Uso diario y por app', cuenta: `${dias} día${dias === 1 ? '' : 's'}`, activa: true,
      encabezado: ['fecha', 'app', 'minutos', 'aperturas'],
      filas: Object.entries(porDiaApp).sort().map(([k, v]) => {
        const [f, n] = k.split('|')
        return [f, app(Number(n)), Math.round(v.min * 10) / 10, v.aperturas]
      }),
    },
    {
      id: 'pausas', titulo: 'Pausas e intervenciones', cuenta: String(pausas.length), activa: true,
      encabezado: ['fecha', 'app', 'nivel', 'duracion_seg', 'ignorada'],
      filas: pausas.map((p) => [p.fecha, app(p.app_numero), p.tipo, p.duracion_seg, p.ignorada ? 'sí' : 'no']),
    },
    {
      id: 'plan', titulo: 'Plan y ajustes semanales', cuenta: `${enRango.length} semana${enRango.length === 1 ? '' : 's'}`, activa: true,
      encabezado: ['semana', 'desde', 'hasta', 'promedio_min_dia', 'limite_min', 'dias_dentro', 'adherencia', 'cambio_pct'],
      filas: enRango.map((s) => [s.semana, fechaISO(s.desde), fechaISO(s.hasta), Math.round(s.promedio), s.limite && Math.round(s.limite), s.diasDentro, s.adherencia?.toFixed(2), s.cambioPlan]),
    },
    {
      id: 'riesgo', titulo: 'Riesgo y factores', cuenta: `${enRango.length} semana${enRango.length === 1 ? '' : 's'}`, activa: true,
      encabezado: ['semana', 'probabilidad', 'nivel'],
      filas: enRango.filter((s) => s.probabilidad != null).map((s) => [s.semana, s.probabilidad.toFixed(2), s.nivel]),
    },
    {
      id: 'foqui', titulo: 'Resúmenes de Foqui', cuenta: `${enRango.length} texto${enRango.length === 1 ? '' : 's'}`, activa: false,
      encabezado: ['semana', 'resumen'],
      filas: enRango.map((s) => [s.semana, textoResumen(s, r, nombre, s === semanas[0]).join(' ')]),
    },
  ]
}

// Un solo CSV con una tabla por sección separada por una línea en blanco (Excel y Sheets lo abren igual)
export function generarCSV(secciones) {
  return secciones.map((s) => [`# ${s.titulo}`, fila(s.encabezado), ...s.filas.map(fila)].join('\n')).join('\n\n')
}

export function tamano(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---------- Descargas recientes (solo en este navegador) ----------

const clave = (id) => `focus.descargas.${id}`
export function leerDescargas(id) {
  try {
    return JSON.parse(localStorage.getItem(clave(id))) ?? []
  } catch {
    return []
  }
}
export function anotarDescarga(id, titulo) {
  const lista = [{ titulo, fecha: new Date().toISOString() }, ...leerDescargas(id)].slice(0, 4)
  try {
    localStorage.setItem(clave(id), JSON.stringify(lista))
  } catch {
    // sin almacenamiento: la lista solo dura esta visita
  }
  return lista
}
