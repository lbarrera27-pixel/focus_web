// Preferencias de visualización de la cuenta (Ajustes › Cuenta › Preferencias, Figma e38):
// zona horaria, formato de hora (24 h o 12 h) y día en que empieza la semana (lunes o domingo).
//
// Zona horaria: en pantalla todas las fechas son "hora de reloj en la zona elegida", guardadas en
// objetos Date del navegador. Los eventos del teléfono ya llegan así (hora local sin zona); las fechas
// del servidor (UTC) y "ahora" se convierten con enZona() / ahoraEnZona(). Si la zona elegida es la
// del navegador, el desfase es 0 y nada cambia.
// Se guardan en /configuracion/me, clave cuenta.preferencias; aquí vive la copia que usan las pantallas.
import { api } from '../api.js'

const CLAVE_DEMO = 'focus.cuenta.demo'
export const ZONA_NAVEGADOR = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City'
const DEFECTO = { semana: 'lunes', hora: '24', zona: ZONA_NAVEGADOR }
let actuales = { ...DEFECTO }

export const preferencias = () => actuales

// Devuelve true si cambió algo (para volver a pintar las secciones)
export function establecerPreferencias(p = {}) {
  const nuevas = {
    semana: p.semana === 'domingo' ? 'domingo' : 'lunes',
    hora: p.hora === '12' ? '12' : '24',
    zona: zonaValida(p.zona) ? p.zona : ZONA_NAVEGADOR,
  }
  const cambio = nuevas.semana !== actuales.semana || nuevas.hora !== actuales.hora || nuevas.zona !== actuales.zona
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

// ---------- Zona horaria ----------

const formatos = new Map()
function formato(zona) {
  if (!formatos.has(zona)) {
    formatos.set(zona, new Intl.DateTimeFormat('en-US', {
      timeZone: zona, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }))
  }
  return formatos.get(zona)
}

function zonaValida(zona) {
  if (!zona) return false
  try {
    formato(zona)
    return true
  } catch {
    return false
  }
}

// Diferencia (ms) entre la hora de reloj de la zona elegida y la del navegador en ese instante
function desfaseMs(instante) {
  if (actuales.zona === ZONA_NAVEGADOR) return 0
  const p = Object.fromEntries(formato(actuales.zona).formatToParts(instante).map((x) => [x.type, Number(x.value)]))
  const relojZona = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  const relojNavegador = instante.getTime() - instante.getTimezoneOffset() * 60_000
  return relojZona - Math.floor(relojNavegador / 1000) * 1000
}

// Instante real (p. ej. una fecha UTC del servidor) → hora de reloj en la zona elegida
export const enZona = (instante) => new Date(instante.getTime() + desfaseMs(instante))

// "Ahora" en la zona elegida: úsese en lugar de new Date() al comparar con fechas de pantalla
export const ahoraEnZona = () => enZona(new Date())
