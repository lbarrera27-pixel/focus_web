// Sección "Foqui" (Figma e33–e35): chat con POST /companero/mensaje y los números de la semana.
// Los números del lateral se calculan aquí (plan, ajustes, riesgo y eventos) para que sigan
// visibles aunque Foqui no responda. En la demo las respuestas son predefinidas.
import { api } from '../api.js'
import { datosDemo } from './demo.js'
import { fechaISO } from './panel.js'
import { horas } from './plan.js'
import { cargarRiesgo } from './riesgo.js'

const DIA_MS = 86_400_000
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const NIVEL_TEXTO = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' }

export const SUGERENCIAS = ['Dame un consejo para la noche', '¿Por qué subió mi riesgo?', 'Resúmeme mi semana']

export function lunes(ahora = new Date()) {
  const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  return new Date(d.getTime() - ((d.getDay() + 6) % 7) * DIA_MS)
}

export function textoSemana(ahora = new Date()) {
  const a = lunes(ahora)
  const b = new Date(a.getTime() + 6 * DIA_MS)
  const mes = (d) => MESES[d.getMonth()]
  return a.getMonth() === b.getMonth()
    ? `Semana del ${a.getDate()} al ${b.getDate()} de ${mes(b)}`
    : `Semana del ${a.getDate()} de ${mes(a)} al ${b.getDate()} de ${mes(b)}`
}

// Eventos desde el lunes de la semana pasada hasta ahora
export async function cargarSemanas(usuario, ahora = new Date()) {
  const desde = new Date(lunes(ahora).getTime() - 7 * DIA_MS)
  const riesgo = cargarRiesgo(usuario).catch(() => null)
  if (usuario.demo) {
    const eventos = datosDemo('30d').eventos.filter((e) => new Date(e.inicio) >= desde)
    return { eventos, riesgo: await riesgo }
  }
  const [eventos, r] = await Promise.all([api.eventos(usuario.id, `${fechaISO(desde)}T00:00:00`, undefined), riesgo])
  return { eventos, riesgo: r }
}

// Promedio diario de esta semana (días transcurridos), comparación con la anterior y minutos por día
export function resumenSemana({ eventos, riesgo }, datos, ahora = new Date()) {
  const inicio = lunes(ahora)
  const minutos = Array(14).fill(0)
  for (const e of eventos) {
    const k = Math.floor((new Date(e.inicio) - inicio) / DIA_MS) + 7
    if (k >= 0 && k < 14) minutos[k] += e.duracion_seg / 60
  }
  const hoy = Math.floor((ahora - inicio) / DIA_MS)
  const estaSemana = minutos.slice(7, 8 + hoy)
  const anterior = minutos.slice(0, 7)
  const promedio = estaSemana.reduce((s, m) => s + m, 0) / estaSemana.length
  const promedioAnterior = anterior.reduce((s, m) => s + m, 0) / 7
  const ajuste = datos?.ajustes?.length ? datos.ajustes[datos.ajustes.length - 1] : null
  return {
    promedio,
    cambio: promedioAnterior > 0 ? Math.round(((promedio - promedioAnterior) / promedioAnterior) * 100) : null,
    dias: DIAS.map((etiqueta, i) => ({ etiqueta, min: minutos[7 + i], hoy: i === hoy, futuro: i > hoy })),
    adherencia: ajuste?.adherencia ?? null,
    cambioPlan: ajuste?.cambio_pct ?? null,
    riesgo: riesgo ? { nivel: riesgo.nivel, probabilidad: riesgo.probabilidad } : null,
  }
}

export const signo = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`

// Etiquetas "Adherencia 86 %", "Límite −5.9 %", "Riesgo medio": lo que Foqui usó para responder
export function datosUsados(r) {
  const lista = []
  if (r.adherencia != null) lista.push(`Adherencia ${Math.round(r.adherencia * 100)} %`)
  if (r.cambioPlan != null) lista.push(`Límite ${signo(r.cambioPlan)} %`)
  if (r.riesgo) lista.push(`Riesgo ${r.riesgo.nivel}`)
  return lista
}

// Viñetas del "Resumen rápido con tus números" cuando Foqui no responde (e35)
export function resumenRapido(r) {
  const lista = [`Promedio diario: ${horas(r.promedio)}${r.cambio != null ? `, ${Math.abs(r.cambio)} % ${r.cambio <= 0 ? 'menos' : 'más'} que la semana anterior` : ''}.`]
  if (r.adherencia != null) lista.push(`Cumpliste tu meta ${Math.round(r.adherencia * 7)} de 7 días (adherencia ${Math.round(r.adherencia * 100)} %).`)
  if (r.cambioPlan != null) {
    lista.push(r.cambioPlan < 0 ? `Tu límite baja ${Math.abs(r.cambioPlan)} % la próxima semana.`
      : r.cambioPlan > 0 ? `Tu límite se relaja ${r.cambioPlan} % la próxima semana.` : 'Tu límite se mantiene igual la próxima semana.')
  }
  if (r.riesgo) lista.push(`Riesgo de recaída: ${r.riesgo.nivel}, ${Math.round(r.riesgo.probabilidad * 100)} %.`)
  return lista
}

// ---------- Modo demo ----------

function respuestaDemo(texto, r, nombre) {
  const t = (texto ?? '').toLowerCase()
  const cambio = r.cambioPlan == null ? 'tu límite se mantiene' : r.cambioPlan < 0 ? `tu límite baja ${Math.abs(r.cambioPlan)} %` : `tu límite se relaja ${r.cambioPlan} %`
  if (!texto) {
    return `¡Hola, ${nombre}! Esta semana usaste el celular ${horas(r.promedio)} al día${r.cambio != null ? `, ${Math.abs(r.cambio)} % ${r.cambio <= 0 ? 'menos' : 'más'} que la anterior` : ''}. ${cambio[0].toUpperCase()}${cambio.slice(1)} y tu riesgo está en ${r.riesgo?.nivel ?? 'revisión'}. Si cuidas la noche, puede bajar pronto.`
  }
  if (t.includes('noche')) return 'Prueba programar el Modo Foco a las 23:30 y dejar el celular fuera del cuarto. Con dos noches así, tu uso nocturno baja bastante.'
  if (t.includes('riesgo')) return `Tu riesgo está en ${r.riesgo?.nivel ?? 'medio'} (${Math.round((r.riesgo?.probabilidad ?? 0.48) * 100)} %). Lo que más lo sube es el uso de noche y las pausas que saltas; lo que más lo baja es tu adherencia.`
  if (t.includes('semana') || t.includes('resum') || t.includes('voy')) {
    const dentro = r.adherencia != null ? `Cumpliste tu meta ${Math.round(r.adherencia * 7)} de 7 días` : 'Aún no cierras tu primera semana'
    return `${dentro} y vas en ${horas(r.promedio)} al día. ${cambio[0].toUpperCase()}${cambio.slice(1)} para la próxima semana.`
  }
  if (t.includes('límite') || t.includes('limite') || t.includes('plan')) return `Tu plan se ajusta cada semana con tus números: ${cambio}. Yo solo te lo explico; el cambio lo calcula Focus!.`
  return 'Puedo explicarte tu plan, tu riesgo y tu uso de la semana. Prueba con una de las sugerencias de abajo. 🙂'
}

function estadoDemo(r) {
  if (r.riesgo?.nivel === 'alto' || (r.adherencia ?? 1) < 0.5) return 'Cansado'
  if ((r.adherencia ?? 0) >= 0.9 && (r.riesgo?.nivel ?? 'bajo') === 'bajo') return 'Feliz'
  if (r.riesgo?.nivel === 'medio' || (r.cambioPlan ?? 0) > 0) return 'Atenta'
  return 'Normal'
}

// { mensaje, estado_foqui, fuente }; en la demo responde tras una espera corta
export async function preguntar(usuario, mensaje, historial, senal, resumen) {
  if (!usuario.demo) return api.foqui(usuario.id, mensaje, historial, senal)
  await new Promise((ok, falla) => {
    const t = setTimeout(ok, 900)
    senal?.addEventListener('abort', () => {
      clearTimeout(t)
      falla(new DOMException('Detenido', 'AbortError'))
    })
  })
  return { mensaje: respuestaDemo(mensaje, resumen, usuario.nombre.split(' ')[0]), estado_foqui: estadoDemo(resumen), fuente: 'respaldo' }
}

// La conversación se guarda en la pestaña para no perderla al cambiar de sección
const clave = (id) => `focus.foqui.${id}`
export function leerChat(id) {
  try {
    return JSON.parse(sessionStorage.getItem(clave(id))) ?? []
  } catch {
    return []
  }
}
export function guardarChat(id, mensajes) {
  try {
    sessionStorage.setItem(clave(id), JSON.stringify(mensajes.slice(-30)))
  } catch {
    // sin almacenamiento: el chat dura mientras la sección esté abierta
  }
}
