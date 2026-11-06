// Riesgo de recaída (Figma e13 con datos, e14 sin datos suficientes, e15 cargando).
// Todo en lenguaje cotidiano: nada de métricas del modelo ni gráficas de contribución.
import { useCallback, useEffect, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Banner, Barra, Encabezado, EstadoVacio, Esqueleto, Kpi, KpiCargando } from '../../components/web/Comunes.jsx'
import { ALTO, FACTORES, cargarRiesgo, porcentaje } from '../../data/riesgo.js'
import { fechaISO } from '../../data/panel.js'
import { limiteActual, ordenar } from '../../data/plan.js'
import { curvaSuave } from '../../data/curva.js'
import iconoAlerta from '../../assets/icons/w-alerta.svg'
import iconoCheckVerde from '../../assets/icons/w-check-verde.svg'
import iconoLuna from '../../assets/icons/w-luna.svg'
import iconoCheck from '../../assets/icons/w-check.svg'
import iconoInfoAzul from '../../assets/icons/w-info-azul.svg'
import iconoReloj from '../../assets/icons/w-reloj.svg'
import iconoMeta from '../../assets/icons/w-meta.svg'
import iconoInsight from '../../assets/icons/ia-insight.svg'
import iconoBurbuja from '../../assets/icons/w-riesgo-burbuja.svg'
import { ahoraEnZona, hora } from '../../data/preferencias.js'
import Ayuda, { useGlobo } from '../../components/web/Ayuda.jsx'
import './Riesgo.css'

const NIVEL = {
  bajo: { texto: 'NIVEL BAJO', icono: iconoCheckVerde },
  medio: { texto: 'NIVEL MEDIO', icono: iconoAlerta },
  alto: { texto: 'NIVEL ALTO', icono: iconoAlerta },
}
const DIA_MS = 86_400_000
const pct = (v) => Math.round(v * 100)

// Cómo se cuenta cada factor cuando complica (sube) o ayuda (baja)
const DIFICULTAD = {
  pct_nocturno: (v) => ({ icono: iconoLuna, titulo: `Sesiones de noche (después de las ${hora(22)})`, texto: `El ${pct(v)} % de tu tiempo fue de noche.` }),
  pct_ignoradas: (v) => ({ icono: iconoReloj, titulo: 'Pausas que dejaste pasar', texto: `Ignoraste el ${pct(v)} % de los recordatorios de respiro.` }),
  adherencia: (v) => ({ icono: iconoMeta, titulo: 'Días por encima de tu límite', texto: `Te mantuviste dentro de tu límite el ${pct(v)} % de la semana.` }),
  pct_foco_completadas: (v) => ({ icono: iconoCheck, titulo: 'Sesiones de foco sin terminar', texto: `Terminaste el ${pct(v)} % de tus sesiones de foco.` }),
  racha: (v) => ({ icono: iconoMeta, titulo: 'Racha todavía corta', texto: `Llevas ${Math.round(v)} semana${Math.round(v) === 1 ? '' : 's'} seguidas cumpliendo.` }),
  cambio_pct: () => ({ icono: iconoMeta, titulo: 'Recorte exigente', texto: 'Tu límite bajó bastante de una semana a otra.' }),
  tendencia: () => ({ icono: iconoReloj, titulo: 'Horarios irregulares', texto: 'Cumpliste menos que la semana anterior.' }),
}
const FORTALEZA = {
  pct_ignoradas: (v) => ({ titulo: 'Respeto a las pausas', texto: v === 0 ? 'No ignoraste ninguna alerta de descanso.' : `Atendiste el ${100 - pct(v)} % de las alertas de descanso.` }),
  adherencia: (v) => ({ titulo: 'Cumples tu límite', texto: `Te mantuviste dentro de tu límite el ${pct(v)} % de la semana.` }),
  pct_nocturno: (v) => ({ titulo: 'Noches tranquilas', texto: `Solo el ${pct(v)} % de tu tiempo fue de noche.` }),
  racha: (v) => ({ titulo: 'Constancia', texto: `${Math.round(v)} semanas seguidas cumpliendo tu límite.` }),
  pct_foco_completadas: (v) => ({ titulo: 'Terminas tus sesiones de foco', texto: `Completaste el ${pct(v)} % de las que empezaste.` }),
  cambio_pct: () => ({ titulo: 'Avanzas a tu ritmo', texto: 'Tu límite baja poco a poco, sin presión.' }),
  tendencia: () => ({ titulo: 'Vas mejorando', texto: 'Cumpliste más que la semana anterior.' }),
}
// Valor grande de la tarjeta "Tu principal punto a favor"
const PUNTO_FAVOR = {
  pct_ignoradas: (v) => ({ valor: `Pausas al ${100 - pct(v)} %`, detalle: v === 0 ? 'Siempre atiendes los recordatorios de respiro' : 'Atiendes casi todos los recordatorios de respiro' }),
  adherencia: (v) => ({ valor: `Límite al ${pct(v)} %`, detalle: 'Te mantienes dentro de tu tiempo objetivo' }),
  pct_nocturno: () => ({ valor: 'Noches tranquilas', detalle: 'Casi no usas el celular de noche' }),
  racha: (v) => ({ valor: `${Math.round(v)} semanas`, detalle: 'seguidas cumpliendo tu límite' }),
  pct_foco_completadas: (v) => ({ valor: `Foco al ${pct(v)} %`, detalle: 'Terminas tus sesiones de foco' }),
  cambio_pct: () => ({ valor: 'Paso a paso', detalle: 'Tu límite baja sin presionarte' }),
  tendencia: () => ({ valor: 'Vas mejorando', detalle: 'Cumpliste más que la semana anterior' }),
}

// Zona de un valor: segura (bajo la línea del modelo), moderada o crítica (desde ALTO)
function zona(p, umbral) {
  if (p >= ALTO) return { id: 'critica', nombre: 'Zona crítica', insignia: 'Atención alta para esta semana', detalle: 'Tendencia a superar tu tiempo objetivo' }
  if (p >= umbral) return { id: 'atencion', nombre: 'Zona moderada', insignia: 'Atención moderada esta semana', detalle: 'Podrías pasarte de tu tiempo objetivo algunos días' }
  return { id: 'segura', nombre: 'Zona segura', insignia: 'Todo bajo control', detalle: 'Vas bien con tu tiempo objetivo' }
}

// Uso de los últimos 7 días completos: días que pasaron el límite y minutos promedio de noche
function semanaDeUso(datos) {
  const eventos = datos?.eventos ?? []
  const plan = datos?.plan
  const limite = plan ? limiteActual(plan, ordenar(datos.ajustes ?? [])) : null
  const hoy = ahoraEnZona()
  const dias = []
  for (let i = 7; i >= 1; i--) {
    const f = new Date(hoy.getTime() - i * DIA_MS)
    dias.push({ iso: fechaISO(f), nombre: f.toLocaleDateString('es-MX', { weekday: 'long' }), min: 0 })
  }
  const porIso = new Map(dias.map((d) => [d.iso, d]))
  let noche = 0
  for (const e of eventos) {
    const ini = new Date(e.inicio)
    const d = porIso.get(fechaISO(ini))
    if (!d) continue
    d.min += e.duracion_seg / 60
    const h = ini.getHours()
    if (h >= 22 || h < 6) noche += e.duracion_seg / 60
  }
  const criticos = limite ? dias.filter((d) => d.min > limite) : []
  return { limite, criticos, nocheProm: noche / 7 }
}

const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

// ---------- Gráfica: evolución semana a semana con zonas de fondo ----------
const ALTO_GRAF = 230
const y = (p) => 220 - p * 210
const yPct = (p) => `${(y(p) / ALTO_GRAF) * 100}%`

function GraficaSemanas({ historial, umbral, factorActual }) {
  const { props, globo } = useGlobo()
  const n = historial.length
  const x = (i) => (n === 1 ? 50 : ((20 + (i * 480) / (n - 1)) / 520) * 100)
  const pts = historial.map((h, i) => [(x(i) / 100) * 520, y(h.probabilidad)])
  const curva = curvaSuave(pts)
  // Área bajo la curva, teñida con el color de la zona actual
  const area = n > 1 ? `${curva} L${pts[n - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z` : ''
  const ultima = n - 1
  const zonaActual = zona(historial[ultima].probabilidad, umbral).id
  const colorArea = { critica: '#f43f5e', atencion: '#f59e0b', segura: '#10b981' }[zonaActual]
  return (
    <figure className="rg-grafica" aria-label="Evolución de tus semanas">
      <ul className="rg-zonas">
        <li className="rg-zonas__segura"><i />Zona segura <span>menos de {porcentaje(umbral)}</span></li>
        <li className="rg-zonas__atencion"><i />Zona moderada <span>{porcentaje(umbral)} a {porcentaje(ALTO)}</span></li>
        <li className="rg-zonas__critica"><i />Zona crítica <span>más de {porcentaje(ALTO)}</span></li>
      </ul>
      <div className="rg-grafica__cuerpo">
        <div className="rg-grafica__escala" aria-hidden="true">
          {[1, 0.8, 0.6, 0.4, 0.2, 0].map((p) => <span key={p} style={{ top: yPct(p) }}>{Math.round(p * 100)} %</span>)}
        </div>
        <div className="rg-grafica__area">
          <svg viewBox={`0 0 520 ${ALTO_GRAF}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {/* Bandas pastel: verde abajo, amarillo en medio, rojo tenue arriba, con transición suave */}
              {/* Bandas muy suaves con transiciones largas entre zonas */}
              <linearGradient id="rg-degradado" x1="0" x2="0" y1={y(1)} y2={y(0)} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#fff1f2" />
                <stop offset={1 - ALTO - 0.06} stopColor="#fff5f5" />
                <stop offset={1 - ALTO + 0.06} stopColor="#fffcf0" />
                <stop offset={1 - umbral - 0.06} stopColor="#fffcf0" />
                <stop offset={1 - umbral + 0.06} stopColor="#f3fdf7" />
                <stop offset="1" stopColor="#ecfdf5" />
              </linearGradient>
              <linearGradient id="rg-area" x1="0" x2="0" y1={y(1)} y2={y(0)} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor={colorArea} stopOpacity="0.28" />
                <stop offset="1" stopColor={colorArea} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <rect x="0" y={y(1)} width="520" height={y(0) - y(1)} fill="url(#rg-degradado)" />
            {[0.2, 0.4, 0.8].map((p) => <line key={p} className="rg-guia" x1="0" x2="520" y1={y(p)} y2={y(p)} />)}
            {/* Umbrales discontinuos entre zonas */}
            <line className="rg-umbral-linea rg-umbral-linea--alto" x1="0" x2="520" y1={y(ALTO)} y2={y(ALTO)} />
            <line className="rg-umbral-linea rg-umbral-linea--alerta" x1="0" x2="520" y1={y(umbral)} y2={y(umbral)} />
            {n > 1 && <path d={area} fill="url(#rg-area)" />}
            {n > 1 && <path className="rg-serie" d={curva} />}
          </svg>
          {historial.map((h, i) => {
            const z = zona(h.probabilidad, umbral)
            const previa = historial[i - 1]
            const dif = previa ? Math.round((h.probabilidad - previa.probabilidad) * 100) : null
            const resumen = dif == null ? 'Primera semana medida.'
              : dif > 0 ? `Subió ${dif} puntos respecto a la semana anterior.`
                : dif < 0 ? `Bajó ${-dif} puntos respecto a la semana anterior. ¡Bien!`
                  : 'Igual que la semana anterior.'
            const borde = n > 1 && i === 0 ? ' rg-punto-grupo--inicio' : n > 1 && i === ultima ? ' rg-punto-grupo--fin' : ''
            return (
              <div key={h.semana} className={`rg-punto-grupo rg-punto-grupo--${z.id}${borde}`} style={{ left: `${x(i)}%`, top: yPct(h.probabilidad) }}>
                {i === ultima && <span className="rg-punto-valor">{porcentaje(h.probabilidad)}</span>}
                <button
                  type="button"
                  className="rg-punto"
                  aria-label={`Semana ${h.semana}: ${porcentaje(h.probabilidad)} de probabilidad de sobreuso. ${resumen}`}
                  {...props(
                    <>
                      <b>Semana {h.semana}</b>
                      <span className={`rg-globo-nivel rg-globo-nivel--${z.id}`}>{porcentaje(h.probabilidad)} de probabilidad de sobreuso</span>
                      <span>{resumen}</span>
                      {i === ultima && factorActual && <span>Lo que más pesó: <b>{factorActual}</b></span>}
                    </>,
                  )}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="rg-grafica__eje" aria-hidden="true">
        {historial.map((h, i) => <span key={h.semana} style={{ left: `${x(i)}%` }}>S{h.semana}</span>)}
      </div>
      {globo}
    </figure>
  )
}

// Meta recomendada según lo que más está subiendo el nivel
function metaRecomendada(r, uso, enZonaSegura) {
  if (enZonaSegura) return 'Estás en la zona segura. Mantén tus horarios esta semana para seguir así.'
  const critica = r.probabilidad >= ALTO
  const destino = critica ? `la zona moderada (menos de ${porcentaje(ALTO)})` : `la zona segura (menos de ${porcentaje(r.umbral)})`
  const faltan = Math.max(1, Math.round((r.probabilidad - (critica ? ALTO : r.umbral)) * 100))
  const top = r.factores.filter((f) => f.efecto === 'sube').sort((a, b) => b.contribucion - a.contribucion)[0]
  const cierre = `Te faltan ${faltan} punto${faltan === 1 ? '' : 's'} para ${destino}.`
  switch (top?.variable) {
    case 'pct_nocturno': {
      const recorte = Math.max(10, Math.round(uso.nocheProm / 3 / 5) * 5)
      return `Si reduces ${recorte} minutos en tus noches esta semana, tu nivel puede bajar. ${cierre}`
    }
    case 'pct_ignoradas': return `Si atiendes cada pausa que te sugiera la app esta semana, tu nivel puede bajar. ${cierre}`
    case 'adherencia': return `Si cumples tu límite al menos 5 de los 7 días, tu nivel puede bajar. ${cierre}`
    case 'pct_foco_completadas': return `Si terminas las sesiones de foco que empieces, tu nivel puede bajar. ${cierre}`
    default: return `Si mantienes tus horarios estables esta semana, tu nivel puede bajar. ${cierre}`
  }
}

// Checklist del día: se guarda solo en este navegador y se reinicia cada día
function useChecklist(clave) {
  const llave = `focus.riesgo.hoy.${clave}.${fechaISO(ahoraEnZona())}`
  const [hechos, setHechos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(llave)) ?? {} } catch { return {} }
  })
  const alternar = (id) => setHechos((h) => {
    const nuevo = { ...h, [id]: !h[id] }
    try { localStorage.setItem(llave, JSON.stringify(nuevo)) } catch { /* sin almacenamiento */ }
    return nuevo
  })
  return [hechos, alternar]
}

function accionesDeHoy(factores) {
  const suben = new Set(factores.filter((f) => f.efecto === 'sube').map((f) => f.variable))
  const acciones = []
  if (suben.has('pct_nocturno')) acciones.push({ id: 'noche', icono: iconoLuna, texto: `Fijar recordatorio nocturno a las ${hora(22)}` })
  acciones.push({ id: 'foco', icono: iconoReloj, texto: 'Activar una sesión de foco de 25 min' })
  if (suben.has('pct_ignoradas')) acciones.push({ id: 'pausa', icono: iconoCheck, texto: 'Atender la próxima pausa que te sugiera la app' })
  if (suben.has('adherencia') || acciones.length < 3) acciones.push({ id: 'limite', icono: iconoMeta, texto: 'Revisar a media tarde cuánto llevas de tu límite' })
  return acciones.slice(0, 3)
}

// Tendencia de las últimas 3 semanas (o las que haya) en palabras
function diagnostico(historial, dificultades, fortalezas) {
  const n = historial.length
  if (n < 2) return { id: 'estable', insignia: 'Primera semana medida', texto: 'Con la próxima semana podremos ver hacia dónde va tu tendencia.' }
  const desde = historial[Math.max(0, n - 3)]
  const hasta = historial[n - 1]
  const semanas = hasta.semana - desde.semana + 1
  const dif = Math.round((hasta.probabilidad - desde.probabilidad) * 100)
  const tramo = `de ${porcentaje(desde.probabilidad)} (S${desde.semana}) a ${porcentaje(hasta.probabilidad)} (S${hasta.semana})`
  const motivos = (xs, fn) => lista(xs.map((f) => fn[f.variable](f.valor).titulo.toLowerCase()))
  if (dif >= 3) {
    return {
      id: 'alza', insignia: `Tendencia al alza (+${dif} pts en ${semanas} semanas)`,
      texto: `Tu nivel subió ${tramo}${dificultades.length ? `, principalmente por ${motivos(dificultades, DIFICULTAD)}` : ''}.`,
    }
  }
  if (dif <= -3) {
    return {
      id: 'baja', insignia: `Tendencia a la baja (${dif} pts en ${semanas} semanas)`,
      texto: `Tu nivel bajó ${tramo}${fortalezas.length ? ` gracias a ${motivos(fortalezas, FORTALEZA)}` : ''}. ¡Vas por buen camino!`,
    }
  }
  return { id: 'estable', insignia: `Tendencia estable (${dif > 0 ? '+' : ''}${dif} pts en ${semanas} semanas)`, texto: `Tu nivel se mantuvo ${tramo}.` }
}

// ---------- e13 · Con datos ----------
function ConDatos({ r, datos }) {
  const historial = r.historial?.length ? r.historial : [{ semana: r.semana, probabilidad: r.probabilidad }]
  const z = zona(r.probabilidad, r.umbral)
  const uso = semanaDeUso(datos)
  const ordenados = [...r.factores].sort((a, b) => Math.abs(b.contribucion) - Math.abs(a.contribucion))
  const dificultades = ordenados.filter((f) => f.efecto === 'sube' && DIFICULTAD[f.variable]).slice(0, 2)
  const fortalezas = ordenados.filter((f) => f.efecto === 'baja' && FORTALEZA[f.variable]).slice(0, 2)
  const favor = fortalezas[0] ? PUNTO_FAVOR[fortalezas[0].variable](fortalezas[0].valor) : { valor: 'En camino', detalle: 'Cada día que cumples suma' }
  const acciones = accionesDeHoy(r.factores)
  const [hechos, alternar] = useChecklist(r.semana)
  const nombresCriticos = uso.criticos.map((d) => d.nombre)
  const tendencia = diagnostico(historial, dificultades, fortalezas)
  const siguiente = historial[historial.length - 1].semana + 1

  return (
    <>
      <div className="w-fila">
        <div className={`w-tarjeta w-kpi rg-kpi rg-kpi--${z.id}`}>
          <p className="w-etiqueta">TU NIVEL DE ATENCIÓN</p>
          <p className="w-display rg-kpi__valor">{porcentaje(r.probabilidad)}</p>
          <span className={`rg-insignia rg-insignia--${z.id} rg-kpi__insignia`}>{z.insignia}</span>
          <p className="w-texto w-texto--2">{z.detalle}</p>
        </div>
        <Kpi
          etiqueta="DÍAS CRÍTICOS DETECTADOS"
          valor={uso.limite == null ? '—' : `${uso.criticos.length} día${uso.criticos.length === 1 ? '' : 's'}`}
          detalle={uso.limite == null ? 'Crea tu plan para compararlos con un límite'
            : uso.criticos.length ? `${lista(nombresCriticos).replace(/^./, (c) => c.toUpperCase())}: donde más se te dificulta desconectarte` : 'Ningún día pasó tu límite esta semana'}
        />
        <Kpi etiqueta="TU PRINCIPAL PUNTO A FAVOR" valor={favor.valor} detalle={favor.detalle} />
      </div>

      <div className="w-fila rg-cuerpo">
        <div className="rg-columna">
          <section className="w-tarjeta rg-tarjeta">
            <div className="rg-titulo">
              <h2 className="w-titulo-3">Evolución de tus semanas</h2>
              <Ayuda
                titulo="Evolución de tus semanas"
                que="Calcula la probabilidad de exceder tu límite durante los próximos 7 días a partir de tus patrones de uso recientes."
                accion="Toca o toca o pasa el ratón por un punto para ver su porcentaje y qué cambió esa semana."
              />
              <em className={`rg-insignia rg-insignia--${z.id} rg-titulo__estado`}>Ahora: {z.nombre}</em>
            </div>
            <GraficaSemanas historial={historial} umbral={r.umbral}
              factorActual={dificultades[0] ? DIFICULTAD[dificultades[0].variable](dificultades[0].valor).titulo : null} />

            <div className="rg-diagnostico">
              <div className="rg-diagnostico__cabeza">
                <p className="rg-grupo__titulo">Diagnóstico de tu tendencia</p>
                <span className={`rg-tendencia rg-tendencia--${tendencia.id}`}>{tendencia.insignia}</span>
              </div>
              <p className="rg-diagnostico__texto">{tendencia.texto}</p>
              <div className={`rg-meta rg-meta--${z.id}`}>
                <span className="rg-meta__icono"><Icono src={iconoMeta} tam={18} /></span>
                <span>
                  <b>Objetivo para S{siguiente}</b>
                  <span>{metaRecomendada(r, uso, z.id === 'segura')}</span>
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="w-tarjeta rg-tarjeta rg-influyo">
          <div className="rg-titulo">
            <h2 className="w-titulo-3">¿Qué influyó esta semana?</h2>
            <Ayuda titulo="¿Qué influyó esta semana?" que="Los hábitos de tu semana que más movieron tu nivel de atención, hacia arriba o hacia abajo." />
          </div>

          {dificultades.length > 0 && (
            <div className="rg-grupo">
              <p className="rg-grupo__titulo rg-grupo__titulo--mal"><i />Cosas que te hicieron más difícil cumplir</p>
              <ul>
                {dificultades.map((f, i) => {
                  const d = DIFICULTAD[f.variable](f.valor)
                  return (
                    <li key={f.variable} className="rg-item rg-item--mal">
                      <span className="rg-item__icono"><Icono src={d.icono} tam={16} /></span>
                      <span><b>{d.titulo}</b><span>{d.texto}</span></span>
                      {i === 0 && <em className="rg-item__peso">Lo que más pesa</em>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {fortalezas.length > 0 && (
            <div className="rg-grupo">
              <p className="rg-grupo__titulo rg-grupo__titulo--bien"><i />Tus mayores fortalezas</p>
              <ul>
                {fortalezas.map((f) => {
                  const d = FORTALEZA[f.variable](f.valor)
                  return (
                    <li key={f.variable} className="rg-item rg-item--bien">
                      <span className="rg-item__icono"><Icono src={iconoCheckVerde} tam={16} /></span>
                      <span><b>{d.titulo}</b><span>{d.texto}</span></span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="w-divisor" />
          <p className="rg-grupo__titulo">Qué puedes hacer hoy</p>
          <ul className="rg-acciones">
            {acciones.map((a) => (
              <li key={a.id}>
                <button type="button" className={`rg-accion${hechos[a.id] ? ' rg-accion--hecha' : ''}`}
                  aria-pressed={!!hechos[a.id]} onClick={() => alternar(a.id)}>
                  <span className="rg-accion__check" aria-hidden="true">{hechos[a.id] ? '✓' : ''}</span>
                  <Icono src={a.icono} tam={16} />
                  <span>{a.texto}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="rg-ficha">
        <Icono src={iconoInsight} tam={18} />
        Este análisis se calcula con tus hábitos de uso de los últimos 7 días para ayudarte a prevenir el agotamiento digital a tiempo.
      </p>
    </>
  )
}

// ---------- e14 · Sin datos suficientes ----------
function SinDatos({ datos, onNavegar }) {
  const medir = useRef(null)
  const plan = datos?.plan
  const hoy = ahoraEnZona()
  const inicio = plan ? new Date(`${plan.fecha_inicio}T00:00:00`) : null
  const diasPlan = inicio ? Math.max(0, Math.floor((hoy - inicio) / DIA_MS) + 1) : 0
  const conEventos = new Set((datos?.eventos ?? []).map((e) => fechaISO(new Date(e.inicio)))).size
  const dias = Math.min(7, plan ? Math.min(diasPlan, conEventos || diasPlan) : conEventos)
  const primerCalculo = inicio ? new Date(inicio.getTime() + 7 * DIA_MS) : null
  const fecha = primerCalculo?.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  const faltan = primerCalculo ? Math.max(1, Math.ceil((primerCalculo - hoy) / DIA_MS)) : null

  const listo = {
    pct_nocturno: (datos?.eventos ?? []).length > 0,
    pct_ignoradas: (datos?.pausas ?? []).length > 0,
  }
  const pendiente = plan ? 'falta 1 semana' : 'falta tu plan'

  return (
    <>
      <div className="w-fila">
        <Kpi etiqueta="TU NIVEL DE ATENCIÓN" valor="—" detalle={faltan ? `disponible en ${faltan} día${faltan === 1 ? '' : 's'}` : 'disponible al crear tu plan'} />
        <Kpi etiqueta="DÍAS CRÍTICOS DETECTADOS" valor="—" detalle="los verás junto con tu nivel" />
        <Kpi etiqueta="TU PRINCIPAL PUNTO A FAVOR" valor="—" detalle="lo sabremos al cerrar tu primera semana" />
      </div>

      <div className="w-fila rg-cuerpo">
        <section className="w-tarjeta rg-tarjeta rg-tarjeta--vacia">
          {plan ? (
            <EstadoVacio
              icono={iconoBurbuja}
              titulo="Todavía no podemos estimar tu riesgo"
              detalle={`Necesitamos 7 datos de tu primera semana completa del plan. Llevas ${dias} de 7 días: el primer cálculo llega el ${fecha}.`}
              accion="Ver qué datos usamos"
              onAccion={() => medir.current?.focus()}
            />
          ) : (
            <EstadoVacio
              icono={iconoBurbuja}
              titulo="Todavía no podemos estimar tu riesgo"
              detalle="El riesgo se calcula con las semanas de tu plan. Crea tu plan y después de una semana verás aquí tu primer cálculo."
              accion="Crear mi plan"
              onAccion={() => onNavegar('plan')}
            />
          )}
          <div className="w-divisor" />
          <p className="w-sobretitulo">TU AVANCE</p>
          <div className="w-fila rg-avance">
            <div>
              <span className="w-etiqueta">SEMANAS CON DATOS</span>
              <b className="w-titulo-2">0 de 1</b>
              <Barra valor={0} />
            </div>
            <div>
              <span className="w-etiqueta">DÍAS REGISTRADOS</span>
              <b className="w-titulo-2">{dias} de 7</b>
              <Barra valor={dias / 7} />
            </div>
          </div>
        </section>

        <section className="w-tarjeta rg-tarjeta rg-medir" ref={medir} tabIndex={-1} aria-labelledby="rg-medir-titulo">
          <div>
            <h2 className="w-titulo-3" id="rg-medir-titulo">Qué va a medir</h2>
            <p className="w-cuerpo w-texto--3">Estos son los 7 datos. Los marcados ya están listos.</p>
          </div>
          <ul className="rg-medir__lista">
            {Object.entries(FACTORES).map(([variable, info]) => {
              const ok = listo[variable]
              return (
                <li key={variable}>
                  <span className={`rg-medir__icono${ok ? ' rg-medir__icono--ok' : ''}`}>
                    <Icono src={ok ? iconoCheckVerde : iconoReloj} tam={14} />
                  </span>
                  <span className="w-cuerpo">{info.titulo}</span>
                  <span className={`rg-medir__estado${ok ? ' rg-medir__estado--ok' : ''}`}>{ok ? 'listo' : pendiente}</span>
                </li>
              )
            })}
          </ul>
          <div className="w-divisor" />
          <p className="w-sobretitulo">POR QUÉ ESPERAMOS</p>
          <div className="rg-porque">
            <Icono src={iconoInfoAzul} tam={16} />
            <span>
              <b className="w-cuerpo">Una semana completa da un cálculo justo</b>
              <span className="w-texto w-texto--2">Con menos datos el riesgo cambiaría mucho de un día a otro.</span>
            </span>
          </div>
        </section>
      </div>
    </>
  )
}

// ---------- e15 · Cargando ----------
function Cargando({ lento }) {
  return (
    <>
      {lento && (
        <Banner
          titulo="Estamos preparando tus datos…"
          detalle="Tarda un poco más de lo normal. Suele estar listo en menos de un minuto; no tienes que hacer nada."
        />
      )}
      <div className="w-fila">
        {['TU NIVEL DE ATENCIÓN', 'DÍAS CRÍTICOS DETECTADOS', 'TU PRINCIPAL PUNTO A FAVOR'].map((e) => <KpiCargando key={e} etiqueta={e} />)}
      </div>
      <div className="w-fila rg-cuerpo" aria-busy="true">
        <section className="w-tarjeta rg-tarjeta rg-tarjeta--cargando">
          <h2 className="w-titulo-3">Evolución de tus semanas</h2>
          <div className="rg-zonas-cargando">
            <Esqueleto alto={90} />
            <Esqueleto alto={40} />
            <Esqueleto alto={110} />
          </div>
          <div className="rg-eje-cargando">
            {Array.from({ length: 8 }, (_, i) => <Esqueleto key={i} alto={10} />)}
          </div>
        </section>
        <section className="w-tarjeta rg-tarjeta rg-tarjeta--cargando">
          <h2 className="w-titulo-3">¿Qué influyó esta semana?</h2>
          {Object.values(FACTORES).map((f, i) => (
            <div key={f.titulo} className="rg-factor-cargando">
              <span>
                <b className="w-cuerpo">{f.titulo}</b>
                <Esqueleto ancho={40} alto={10} />
              </span>
              <Esqueleto ancho={[100, 56, 40, 30, 24, 20, 12][i]} alto={10} />
            </div>
          ))}
          <Esqueleto />
          <Esqueleto />
          <Esqueleto />
        </section>
      </div>
    </>
  )
}

export default function Riesgo({ usuario, datos, onNavegar }) {
  const [estado, setEstado] = useState({ cargando: true, riesgo: null, error: null })
  const [lento, setLento] = useState(false)

  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    setLento(false)
    const aviso = setTimeout(() => setLento(true), 3000)
    try {
      const riesgo = await cargarRiesgo(usuario)
      setEstado({ cargando: false, riesgo, error: null })
    } catch (err) {
      setEstado({ cargando: false, riesgo: null, error: err.message || 'No se pudo conectar con la API' })
    } finally {
      clearTimeout(aviso)
    }
  }, [usuario])

  useEffect(() => {
    cargar()
  }, [cargar])

  const { cargando, riesgo, error } = estado
  const nivel = riesgo && NIVEL[riesgo.nivel]

  return (
    <div className="w-pagina rg">
      <Encabezado sobretitulo="RIESGO · PRÓXIMA SEMANA" titulo="Riesgo de recaída">
        {nivel && !cargando && (
          <span className={`rg-nivel rg-nivel--${riesgo.nivel}`}>
            <Icono src={nivel.icono} tam={14} tinta={riesgo.nivel === 'alto' ? '#b91c1c' : undefined} />
            {nivel.texto}
          </span>
        )}
      </Encabezado>

      {error ? (
        <Banner
          tono="error"
          titulo="No pudimos calcular tu riesgo"
          detalle={error}
          accion={<button type="button" className="w-boton w-boton--secundario" onClick={cargar}>Reintentar</button>}
        />
      ) : cargando ? (
        <Cargando lento={lento} />
      ) : riesgo ? (
        <ConDatos r={riesgo} datos={datos} />
      ) : (
        <SinDatos datos={datos} onNavegar={onNavegar} />
      )}
    </div>
  )
}
