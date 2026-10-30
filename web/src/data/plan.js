// Sección "Mi plan": límite actual, ajustes semanales (lógica difusa) y simulación por sensibilidad.
// Las preferencias del plan (meta, duración, sensibilidad…) viven en /configuracion/me, clave "plan";
// la API las usa al calcular cada ajuste (app/utils/reglas_plan.py · aplicar_preferencias).
import { api } from '../api.js'
import { inferir } from './difuso.js'
import { fechaServidor } from './panel.js'

const DIA_MS = 86_400_000
const SEMANA_MS = 7 * DIA_MS
const CLAVE_DEMO = 'focus.plan.demo'

export const SENSIBILIDADES = [
  { id: 'suave', titulo: 'Suave', factor: 0.5, detalle: 'Baja hasta −5 % por semana. Relaja +5 % si la adherencia es baja.' },
  { id: 'normal', titulo: 'Normal', factor: 1, detalle: 'Baja hasta −10 % por semana.' },
  { id: 'estricta', titulo: 'Estricta', factor: 1.5, detalle: 'Baja hasta −15 % y solo relaja si fallas dos semanas seguidas.' },
]
export const DIAS_CORTE = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export function preferenciasPorDefecto(plan) {
  const base = plan?.limite_base ?? 240
  return {
    meta_min: Math.max(60, Math.round((base * 0.5) / 15) * 15),
    semanas: 8,
    dia_corte: 'lunes',
    sensibilidad: 'normal',
    permitir_relajar: true,
  }
}

// Igual que aplicar_preferencias de la API
export function aplicarPreferencias(cambio, sensibilidad = 'normal', permitirRelajar = true, anteriorBaja = false) {
  if (cambio > 0) return !permitirRelajar || (sensibilidad === 'estricta' && !anteriorBaja) ? 0 : cambio
  const factor = SENSIBILIDADES.find((s) => s.id === sensibilidad)?.factor ?? 1
  return Math.round(cambio * factor * 10) / 10 + 0
}

export async function cargarPreferencias(usuario, plan) {
  const defecto = preferenciasPorDefecto(plan)
  try {
    const guardadas = usuario.demo
      ? JSON.parse(localStorage.getItem(CLAVE_DEMO) ?? 'null')
      : (await api.configuracion(usuario.id))?.plan
    return { ...defecto, ...(guardadas ?? {}) }
  } catch {
    return defecto
  }
}

export async function guardarPreferencias(usuario, prefs) {
  if (usuario.demo) {
    try {
      localStorage.setItem(CLAVE_DEMO, JSON.stringify(prefs))
    } catch {
      // sin almacenamiento: los cambios de la demo duran solo esta visita
    }
    return
  }
  // Se conserva el resto de la configuración (ajustes del portal) y solo se reemplaza "plan"
  const actual = (await api.configuracion(usuario.id)) ?? {}
  await api.guardarConfiguracion(usuario.id, { ...actual, plan: prefs })
}

// ---------- Cálculos ----------

export const ordenar = (ajustes = []) => [...ajustes].sort((a, b) => a.semana - b.semana)

// El límite arranca en limite_base y cada ajuste lo cambia en su cambio_pct
export function limiteActual(plan, ajustes) {
  return Math.round(ordenar(ajustes).reduce((lim, a) => lim * (1 + a.cambio_pct / 100), plan.limite_base))
}

export function inicioSemana(plan, semana) {
  return new Date(new Date(`${plan.fecha_inicio}T00:00:00`).getTime() + (semana - 1) * SEMANA_MS)
}

// Proporción de pausas ignoradas en una semana del plan (las fechas del servidor están en UTC)
export function ignoradasSemana(plan, semana, pausas = []) {
  const desde = inicioSemana(plan, semana).getTime()
  const hasta = desde + SEMANA_MS
  const lista = pausas.filter((p) => {
    const t = fechaServidor(p.fecha).getTime()
    return t >= desde && t < hasta
  })
  return lista.length ? lista.filter((p) => p.ignorada).length / lista.length : 0
}

// Semanas que tardaría en llegar a la meta y límites de las próximas semanas con cada sensibilidad
export function simular(limite, meta, adherencia, ignoradas, permitirRelajar, semanaActual, semanasTabla = 3) {
  const { cambio } = inferir(adherencia, ignoradas)
  return Object.fromEntries(SENSIBILIDADES.map((s) => {
    const c = aplicarPreferencias(cambio, s.id, permitirRelajar)
    const limites = []
    let lim = limite
    let llega = lim <= meta ? semanaActual : null
    for (let k = 1; k <= 52; k++) {
      lim = Math.max(meta, lim * (1 + c / 100))
      if (k <= semanasTabla) limites.push(Math.round(lim))
      if (llega == null && Math.round(lim) <= meta) llega = semanaActual + k
      if (k >= semanasTabla && (llega != null || c >= 0)) break
    }
    return [s.id, { cambio: c, limites, llega }]
  }))
}

// ---------- Formato ----------

export function horas(min, { corto = false } = {}) {
  const m = Math.round(min)
  const h = Math.floor(m / 60)
  const r = String(m % 60).padStart(2, '0')
  if (corto) return `${h} h ${r}`
  return h ? `${h} h ${r} min` : `${m % 60} min`
}

export const porcentaje = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${Math.abs(v).toFixed(1)} %`

export function fechaLarga(fecha) {
  return fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const DIA_MS_PLAN = DIA_MS
