// Preferencias de visualización de la cuenta (Ajustes › Cuenta › Preferencias, Figma e38):
// formato de hora (24 h o 12 h) y día en que empieza la semana (lunes o domingo).
// Se guardan en /configuracion/me, clave cuenta.preferencias; aquí vive la copia que usan las pantallas.
import { api } from '../api.js'

const CLAVE_DEMO = 'focus.cuenta.demo'
const DEFECTO = { semana: 'lunes', hora: '24' }
let actuales = { ...DEFECTO }

export const preferencias = () => actuales

// Devuelve true si cambió algo (para volver a pintar las secciones)
export function establecerPreferencias(p = {}) {
  const nuevas = { semana: p.semana === 'domingo' ? 'domingo' : 'lunes', hora: p.hora === '12' ? '12' : '24' }
  const cambio = nuevas.semana !== actuales.semana || nuevas.hora !== actuales.hora
  actuales = nuevas
  return cambio
}

export async function cargarPreferencias(usuario) {
  try {
    const config = usuario.demo ? JSON.parse(localStorage.getItem(CLAVE_DEMO) ?? '{}') : await api.configuracion(usuario.id)
    return config?.cuenta?.preferencias ?? DEFECTO
  } catch {
    return DEFECTO
  }
}

// hora(22) → "22:00" o "10:00 p. m."; también acepta "23:30"
export function hora(h, m = 0) {
  if (typeof h === 'string') [h, m] = h.split(':').map(Number)
  h = ((h % 24) + 24) % 24
  const mm = String(m).padStart(2, '0')
  if (actuales.hora === '24') return `${String(h).padStart(2, '0')}:${mm}`
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

export const horaDe = (d) => hora(d.getHours(), d.getMinutes())

// Índices de los días (0 = lunes … 6 = domingo) en el orden de la semana elegida
export const ordenDias = () => (actuales.semana === 'domingo' ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6])

// Primer día (a las 00:00) de la semana que contiene `d`
export function inicioDeSemana(d) {
  const desfase = actuales.semana === 'domingo' ? d.getDay() : (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - desfase)
}
