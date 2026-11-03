// Ajustes de la cuenta (Figma e38–e41): perfil, avisos, privacidad y teléfono vinculado.
// - Perfil y contraseña: GET/PUT /usuarios/me. Foto: POST /usuarios/me/foto/archivo.
// - Preferencias, avisos e historial: GET/PUT /configuracion/me, clave "cuenta" (se conserva el resto).
//   "Participar en el estudio" es la misma clave consentimientoRetirado que usa Apps y sitios.
// - En la demo todo se guarda en el navegador.
import { api } from '../api.js'
import { fechaISO, fechaServidor } from './panel.js'

const CLAVE_DEMO = 'focus.cuenta.demo'
const MIN_MS = 60_000

export const CUENTA_DEFECTO = {
  preferencias: { zona: 'America/Mexico_City', semana: 'lunes', hora: '24' },
  avisos: { limite: true, cercaLimite: true, modoFoco: true, resumen: true, riesgo: true, correo: false },
  silencio: { desde: '23:00', hasta: '07:00', finesDeSemana: true },
  compartirFoqui: false,
  // [{ texto, fecha ISO }] del más reciente al más antiguo
  historial: [],
  solicitudBorrado: null,
  passwordCambiada: null,
}

export const ZONAS = [
  { id: 'America/Mexico_City', titulo: 'Querétaro (GMT−6)' },
  { id: 'America/Cancun', titulo: 'Cancún (GMT−5)' },
  { id: 'America/Mazatlan', titulo: 'Mazatlán (GMT−7)' },
  { id: 'America/Tijuana', titulo: 'Tijuana (GMT−8)' },
]

const conDefecto = (c = {}) => ({
  ...structuredClone(CUENTA_DEFECTO),
  ...c,
  preferencias: { ...CUENTA_DEFECTO.preferencias, ...c.preferencias },
  avisos: { ...CUENTA_DEFECTO.avisos, ...c.avisos },
  silencio: { ...CUENTA_DEFECTO.silencio, ...c.silencio },
})

function leerDemo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DEMO)) ?? {}
  } catch {
    return {}
  }
}

// { perfil, config }: config es todo /configuracion/me (para leer modo foco, apps inactivas y consentimiento)
export async function cargarCuenta(usuario) {
  if (usuario.demo) {
    const config = leerDemo()
    const perfil = { id: 0, nombre: usuario.nombre, email: 'demo@focus.app', foto_url: null, fecha_registro: new Date(Date.now() - 30 * 86_400_000).toISOString() }
    return { perfil, config, cuenta: conDefecto(config.cuenta) }
  }
  const [perfil, config] = await Promise.all([api.usuario(usuario.id), api.configuracion(usuario.id).catch(() => ({}))])
  return { perfil, config: config ?? {}, cuenta: conDefecto(config?.cuenta) }
}

// Reemplaza solo las claves indicadas ({ cuenta, consentimientoRetirado… }) y devuelve la configuración completa
export async function guardarConfig(usuario, cambios) {
  if (usuario.demo) {
    const config = { ...leerDemo(), ...cambios }
    try {
      localStorage.setItem(CLAVE_DEMO, JSON.stringify(config))
    } catch {
      // sin almacenamiento: los cambios de la demo duran solo esta visita
    }
    return config
  }
  const actual = (await api.configuracion(usuario.id)) ?? {}
  return api.guardarConfiguracion(usuario.id, { ...actual, ...cambios })
}

export const conHistorial = (cuenta, texto, fecha = new Date()) => ({
  ...cuenta,
  historial: [{ texto, fecha: fecha.toISOString() }, ...cuenta.historial].slice(0, 20),
})

// Lo que se muestra en "Historial de permisos": cambios guardados y, al final, el registro (consentimiento inicial)
export function historialPermisos(cuenta, perfil) {
  const inicial = perfil ? [{ texto: 'Aceptaste participar en el estudio', fecha: fechaServidor(perfil.fecha_registro).toISOString() }] : []
  return [...cuenta.historial, ...inicial]
}

export const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
export const fechaLarga = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })

export function haceTexto(fecha, ahora = Date.now()) {
  if (!fecha) return 'sin datos'
  const min = Math.round((ahora - new Date(fecha).getTime()) / MIN_MS)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `hace ${d} día${d === 1 ? '' : 's'}`
  const m = Math.round(d / 30)
  return `hace ${m} mes${m === 1 ? '' : 'es'}`
}

// "Chrome en Windows" a partir del navegador actual
export function esteNavegador(ua = navigator.userAgent) {
  const navegador = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador'
  const sistema = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null
  return sistema ? `${navegador} en ${sistema}` : navegador
}

// Teléfono vinculado: el token Android activo más reciente y la hora del último evento que envió
export function telefonoVinculado(datos, ahora = Date.now()) {
  if (!datos) return null
  const activos = datos.tokens.filter((t) => t.activo)
  const token = activos.filter((t) => t.plataforma === 'android').at(-1) ?? activos.at(-1) ?? null
  const ultimo = datos.eventos.reduce((max, e) => (!max || e.fin > max ? e.fin : max), null)
  if (!token) return { token: null, ultimo }
  // "Conectado" si envió uso en los últimos 30 minutos
  const conectado = Boolean(ultimo) && ahora - new Date(ultimo).getTime() < 30 * MIN_MS
  return { token, ultimo, conectado, desde: fechaServidor(token.fecha_registro) }
}

// Los permisos se deducen de lo que llega: hay eventos → "Uso de apps"; hay pausas → accesibilidad y superposición
export function permisos(datos) {
  const uso = Boolean(datos?.eventos.length)
  const pausas = Boolean(datos?.pausas.length)
  return [
    { id: 'uso', titulo: 'Uso de apps', desc: 'Para saber cuánto tiempo usas cada app.', ok: uso },
    { id: 'accesibilidad', titulo: 'Accesibilidad', desc: 'Para mostrar la pausa antes de abrir una app.', ok: pausas },
    { id: 'superponer', titulo: 'Mostrar sobre otras apps', desc: 'Para que la pausa aparezca encima.', ok: pausas },
  ]
}

// Eventos por hora de hoy (24 barras)
export function actividadHoy(datos, ahora = new Date()) {
  const horas = Array(24).fill(0)
  const hoy = fechaISO(ahora)
  for (const e of datos?.eventos ?? []) {
    const d = new Date(e.inicio)
    if (fechaISO(d) === hoy) horas[d.getHours()] += 1
  }
  return horas
}
