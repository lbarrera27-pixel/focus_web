// Pestaña "Sitios bloqueados" (Figma e24–e28).
// - La lista vive en la API (/dominios); pausar un sitio es PUT activo=false.
// - El horario de cada sitio y hasta cuándo está en pausa van en GET/PUT /configuracion/me, clave
//   "sitios", indexados por dominio para que sobrevivan a quitar y volver a añadir el sitio.
// - Los intentos los registra el teléfono (POST /dominios/{n}/intentos) y aquí se leen resumidos.
import { api } from '../api.js'
import { fechaISO } from './panel.js'

const DIA_MS = 86_400_000
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const PATRON = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/

export const SUGERENCIAS = ['youtube.com', 'instagram.com', 'tiktok.com', 'twitch.tv', 'netflix.com', 'facebook.com', 'reddit.com', 'x.com']

export function horarios(modoFoco) {
  return [
    { id: 'siempre', texto: 'Siempre' },
    { id: 'noche', texto: '22:00 – 06:00' },
    { id: 'estudio', texto: `Estudio · ${modoFoco.inicio} – ${modoFoco.fin}` },
  ]
}

// "https://www.YouTube.com/watch?v=1" → "youtube.com"
export const normalizar = (texto) =>
  texto.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0]

export function validar(texto, lista) {
  const dominio = normalizar(texto)
  if (!dominio) return { error: 'Escribe la dirección del sitio, por ejemplo youtube.com.' }
  if (!PATRON.test(dominio) || dominio.length > 255) return { error: `“${texto.trim()}” no parece un sitio web. Usa el formato ejemplo.com.` }
  if (lista.some((s) => s.dominio === dominio)) return { error: `${dominio} ya está en tu lista.` }
  return { dominio }
}

export function mananaISO(ahora = new Date()) {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1).toISOString()
}

// ---------- Modo demo: la lista vive en memoria mientras la pestaña esté abierta ----------

let demo = null
function datosDemo() {
  if (demo) return demo
  const hoy = new Date()
  const porDia = [4, 3, 5, 8, 7, 2, 2]
  demo = {
    siguiente: 5,
    dominios: [
      { numero: 1, dominio: 'youtube.com', activo: true },
      { numero: 2, dominio: 'reddit.com', activo: true },
      { numero: 3, dominio: 'tiktok.com', activo: true },
      { numero: 4, dominio: 'x.com', activo: false },
    ],
    intentos: {
      dias: 7,
      total: 31,
      por_dominio: [
        { dominio: 'youtube.com', numero: 1, intentos: 14 },
        { dominio: 'tiktok.com', numero: 3, intentos: 9 },
        { dominio: 'reddit.com', numero: 2, intentos: 6 },
        { dominio: 'x.com', numero: 4, intentos: 2 },
      ],
      por_dia: porDia.map((n, k) => ({ fecha: fechaISO(new Date(hoy.getTime() - (6 - k) * DIA_MS)), intentos: n })),
    },
  }
  return demo
}

export const SITIOS_DEMO = { 'reddit.com': { horario: 'noche' }, 'x.com': { horario: 'siempre', pausaHasta: mananaISO() } }

export async function cargarSitios(usuario) {
  if (usuario.demo) {
    const d = datosDemo()
    return { dominios: structuredClone(d.dominios), intentos: structuredClone(d.intentos) }
  }
  const [dominios, intentos] = await Promise.all([api.dominios(usuario.id), api.intentosSitios(usuario.id, 7)])
  return { dominios, intentos }
}

export async function crearSitio(usuario, dominio) {
  if (!usuario.demo) return api.crearDominio(usuario.id, dominio)
  const d = datosDemo()
  const nuevo = { numero: d.siguiente++, dominio, activo: true }
  d.dominios.push(nuevo)
  return nuevo
}

export async function actualizarSitio(usuario, numero, cambios) {
  if (!usuario.demo) return api.actualizarDominio(usuario.id, numero, cambios)
  const sitio = datosDemo().dominios.find((s) => s.numero === numero)
  Object.assign(sitio, cambios)
  return { ...sitio }
}

export async function eliminarSitio(usuario, numero) {
  if (!usuario.demo) return api.eliminarDominio(usuario.id, numero)
  const d = datosDemo()
  d.dominios = d.dominios.filter((s) => s.numero !== numero)
}

// ---------- Vista ----------

export function resumenSitios({ dominios, intentos }, config = {}, ahora = new Date()) {
  const porDominio = Object.fromEntries(intentos.por_dominio.map((x) => [x.dominio, x.intentos]))
  const filas = dominios.map((s) => {
    const c = config[s.dominio] ?? {}
    const pausaHasta = !s.activo && c.pausaHasta ? new Date(c.pausaHasta) : null
    return { ...s, horario: c.horario ?? 'siempre', pausaHasta, intentos: porDominio[s.dominio] ?? 0 }
  })
  const dias = intentos.por_dia.map((d) => {
    const fecha = new Date(`${d.fecha}T00:00:00`)
    return { ...d, etiqueta: DIAS_CORTOS[fecha.getDay()], hoy: d.fecha === fechaISO(ahora) }
  })
  return {
    filas,
    dias,
    maxDia: Math.max(1, ...dias.map((d) => d.intentos)),
    top: intentos.por_dominio.slice(0, 4),
    total: intentos.total,
  }
}

// Sitios cuya pausa ya terminó: hay que volver a activarlos
export const pausasVencidas = (dominios, config, ahora = new Date()) =>
  dominios.filter((s) => !s.activo && config[s.dominio]?.pausaHasta && new Date(config[s.dominio].pausaHasta) <= ahora)
