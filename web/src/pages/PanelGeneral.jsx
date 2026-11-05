import { useState } from 'react'
import Card, { Insignia } from '../components/Card.jsx'
import Icono from '../components/Icono.jsx'
import iconoTelefono from '../assets/icons/phone.svg'
import iconoCheck from '../assets/icons/check.svg'
import iconoCerebro from '../assets/icons/brain.svg'
import iconoPulso from '../assets/icons/pulse.svg'
import iconoActualizar from '../assets/icons/cu-actualizar.svg'
import { fechaISO, formatoDuracion } from '../data/panel.js'
import { ahoraEnZona, hora } from '../data/preferencias.js'
import Ayuda, { useGlobo } from '../components/web/Ayuda.jsx'
import { curvaSuave } from '../data/curva.js'
import './PanelGeneral.css'

// ---------- Telemetría ----------

function TelemetryCard({ t, onRecargar }) {
  const [sincronizando, setSincronizando] = useState(false)
  const { props, globo } = useGlobo({ arriba: true })
  async function sincronizar() {
    setSincronizando(true)
    try {
      await onRecargar?.()
    } finally {
      setSincronizando(false)
    }
  }
  return (
    <Card
      className="card--telemetria card--legible pg-telemetria"
      etiqueta="TU CELULAR"
      titulo="Sincronización del dispositivo"
      ayuda={<Ayuda titulo="Sincronización del dispositivo"
        que="Muestra si tu celular está enviando tus datos de uso para que tus reportes estén al día." />}
      extra={<Insignia vivo={t.servicioActivo}>{t.servicioActivo ? 'CONECTADO' : 'SIN SEÑAL'}</Insignia>}
    >
      <div className="dispositivo">
        <span className="dispositivo__icono">
          <Icono src={iconoTelefono} tam={23} />
        </span>
        <span className="dispositivo__texto">
          <b>{t.dispositivo}</b>
          <small>{t.detalle}</small>
        </span>
        <span className="pg-dispositivo__estado">
          {t.vinculado ? (
            <span className="vinculado">
              <Icono src={iconoCheck} tam={12} /> Vinculado
            </span>
          ) : (
            <span className="vinculado vinculado--no">Sin vincular</span>
          )}
          <small className="pg-senal">
            <span className={`punto ${t.servicioActivo ? 'punto--ok' : 'punto--off'}`} />
            Última señal: {t.heartbeat.toLowerCase()}
          </small>
        </span>
      </div>

      {/* Dos paneles para completar el centro de control de la sincronización */}
      <div className="pg-telemetria__paneles">
        <section className="pg-telemetria__panel" aria-label="Métricas de sincronización">
          <p className="pg-telemetria__titulo">Métricas de sincronización</p>
          <dl>
            <div><dt>Última sincronización</dt><dd>{t.heartbeat} <small>(automática)</small></dd></div>
            <div><dt>Datos transferidos</dt><dd>{t.eventos.toLocaleString('es-MX')} registros de actividad</dd></div>
            <div><dt>Tiempo total medido</dt><dd>{hm(t.minutosUso)} acumuladas</dd></div>
          </dl>
        </section>
        <section className="pg-telemetria__panel" aria-label="Estado de conexión y permisos">
          <p className="pg-telemetria__titulo">Conexión y permisos</p>
          <dl>
            <div>
              <dt>Servicio en segundo plano</dt>
              <dd className={t.servicioActivo ? 'pg-ok' : 'pg-apagado'}>{t.servicioActivo ? 'Activo' : 'Sin actividad en 24 h'}</dd>
            </div>
            <div>
              <dt className="pg-dt-ayuda">
                Permiso de uso de apps
                <Ayuda titulo="Permiso de uso de apps"
                  que="Permiso necesario en Android para que la aplicación pueda medir los tiempos de pantalla." />
              </dt>
              <dd className={t.permisoUso ? 'pg-ok' : 'pg-apagado'}>{t.permisoUso ? 'Concedido' : 'Sin datos aún'}</dd>
            </div>
          </dl>
          <button type="button" className="pg-telemetria__boton" onClick={sincronizar} disabled={sincronizando || !onRecargar}
            {...props(<span>Fuerza el envío inmediato de los últimos datos de uso desde tu celular hacia tus reportes.</span>)}>
            <Icono src={iconoActualizar} tam={14} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </section>
      </div>
      {globo}
    </Card>
  )
}

// ---------- Patrones de uso (antes "Clústeres") ----------

const ANCHO_D = 568
const ALTO_D = 151
const EJE = { izq: 103, der: 487, arr: 13, abj: 129 }

// Cada grupo se describe solo por cómo son sus sesiones (sin tipos de app)
const SESIONES = {
  rapidas: { titulo: 'Sesiones rápidas', tipo: 'Sesión rápida', resumen: 'entradas breves de pocos minutos' },
  largas: { titulo: 'Sesiones largas', tipo: 'Sesión prolongada', resumen: 'períodos continuos y prolongados de uso' },
  cortas: { titulo: 'Sesiones cortas recurrentes', tipo: 'Sesión corta', resumen: 'consultas rápidas y repetidas' },
}
// Orden de la leyenda: amarillo, rojo, verde
const ORDEN_LEYENDA = ['rapidas', 'largas', 'cortas']

const promedio = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)
const minutosTexto = (m) => (m >= 1 ? `${m.toFixed(1)} min` : `${Math.round(m * 60)} s`)

function ClusterCard({ c }) {
  const { props, globo } = useGlobo()
  const maxDur = Math.max(1, ...c.puntos.map((p) => p.duracionMedia))
  const maxAp = Math.max(1, ...c.puntos.map((p) => p.aperturas))
  const pos = (p) => ({
    x: EJE.izq + 14 + (p.duracionMedia / maxDur) * (EJE.der - EJE.izq - 28),
    y: EJE.abj - 12 - (p.aperturas / maxAp) * (EJE.abj - EJE.arr - 24),
    r: 2.4 + (p.aperturas / maxAp) * 2.6,
  })
  // Resumen de cada grupo: minutos promedio por sesión y veces abiertas al día (por app)
  const grupos = c.grupos.map((g, i) => {
    const pts = c.puntos.filter((p) => p.grupo === i)
    return { ...g, ...SESIONES[g.id], minSesion: promedio(pts.map((p) => p.duracionMedia)), aperturasDia: promedio(pts.map((p) => p.aperturas)) }
  })
  const elipses = grupos.map((g, i) => {
    const pts = c.puntos.filter((p) => p.grupo === i).map(pos)
    if (!pts.length) return null
    // Elipse centrada en la media con radio de 1.2 desviaciones estándar (acotada al área del gráfico)
    const desv = (v, m) => Math.sqrt(promedio(v.map((x) => (x - m) ** 2)))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const cx = promedio(xs)
    const cy = promedio(ys)
    return {
      g,
      cx,
      cy,
      rx: Math.min(desv(xs, cx) * 1.2 + 14, (EJE.der - EJE.izq) / 5),
      ry: Math.min(desv(ys, cy) * 1.2 + 12, (EJE.abj - EJE.arr) / 2.6),
    }
  })
  // Globo: solo tipo de sesión, duración estimada y frecuencia
  const detalleSesion = (tipo, duracion, frecuencia) => (
    <>
      <span className="ayuda-globo__fila">Tipo de sesión <b>{tipo}</b></span>
      <span className="ayuda-globo__fila">Duración estimada <b>{duracion}</b></span>
      <span className="ayuda-globo__fila">Frecuencia <b>{frecuencia}</b></span>
    </>
  )
  const resumenGrupo = (g) =>
    g.puntos
      ? detalleSesion(g.titulo, `${minutosTexto(g.minSesion)} en promedio`, `${g.aperturasDia.toFixed(1)} aperturas al día`)
      : detalleSesion(g.titulo, '—', 'Sin sesiones de este tipo en el periodo')

  return (
    <Card
      className="card--clusteres card--legible"
      etiqueta="TUS SESIONES · PERIODO ELEGIDO"
      titulo="Tus patrones de uso"
      ayuda={
        <Ayuda
          titulo="Tus patrones de uso"
          que="Agrupa tus sesiones de uso según cuánto tiempo duran y cuántas veces abres el dispositivo, ayudándote a identificar si tu uso es compulsivo o prolongado."
          accion="Muchas sesiones rápidas suelen ser uso compulsivo: prueba la pausa antes de abrir. Si dominan las sesiones largas, ponte un límite de tiempo por sesión."
        />
      }
      extra={
        <div className="cifra-header">
          <b>{c.total.toLocaleString('es-MX')}</b>
          <small>usos registrados</small>
        </div>
      }
    >
      <div className="clusteres pg-patrones">
        <svg className="dispersion" viewBox={`0 0 ${ANCHO_D} ${ALTO_D}`} role="img" aria-label="Tus sesiones según cuántas veces abres el dispositivo y cuántos minutos duran">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={EJE.izq} x2={EJE.der} y1={EJE.arr + f * (EJE.abj - EJE.arr)} y2={EJE.arr + f * (EJE.abj - EJE.arr)} stroke="#edf1f5" />
          ))}
          <polyline points={`${EJE.izq},${EJE.arr} ${EJE.izq},${EJE.abj} ${EJE.der},${EJE.abj}`} fill="none" stroke="#e2e8f0" />
          <clipPath id="area-dispersion">
            <rect x={EJE.izq} y={0} width={EJE.der - EJE.izq + 40} height={EJE.abj} />
          </clipPath>
          <g clipPath="url(#area-dispersion)">
            {elipses.map(
              (e, i) =>
                e && (
                  <ellipse key={i} className="pg-elipse" cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={e.g.color} fillOpacity="0.08"
                    stroke={e.g.color} strokeOpacity="0.4" strokeDasharray="3 3" {...props(resumenGrupo(e.g))} />
                ),
            )}
          </g>
          {c.puntos.map((p) => {
            const { x, y, r } = pos(p)
            const g = grupos[p.grupo]
            return (
              <circle key={p.id} className="pg-punto" cx={x} cy={y} r={r} fill={g.color}
                {...props(detalleSesion(g.tipo, minutosTexto(p.duracionMedia), `${p.aperturas} ${p.aperturas === 1 ? 'apertura' : 'aperturas'}`))}
              />
            )
          })}
          <text x="96" y="70" textAnchor="end" className="dispersion__eje">Veces abierta</text>
          <text x="295" y="148" textAnchor="middle" className="dispersion__eje">Duración de la sesión (minutos) →</text>
          {!c.puntos.length && (
            <text x="295" y="72" textAnchor="middle" className="dispersion__vacio">Sin uso en el periodo</text>
          )}
        </svg>

        {/* Leyenda compacta debajo de la gráfica; el detalle va en el globo */}
        <ul className="pg-patrones__leyenda">
          {ORDEN_LEYENDA.map((id) => grupos.find((g) => g.id === id)).map((g) => (
            <li key={g.id} tabIndex={0} aria-label={`${g.titulo}: ${g.porcentaje} % de tus aperturas`} {...props(resumenGrupo(g))}>
              <i style={{ background: g.color }} />
              {g.titulo} <b>({g.porcentaje}%)</b>
            </li>
          ))}
        </ul>
      </div>
      {globo}
    </Card>
  )
}

// ---------- Mapa de riesgo por hora ----------

// Reloj radial de 24 h: 00 arriba, 06 a la derecha, 12 abajo, 18 a la izquierda (sentido del reloj)
const RELOJ = { c: 150, interior: 50, base: 74, extra: 56 }
const anguloHora = (h) => ((h / 24) * 360 - 90) * (Math.PI / 180)
const punto = (radio, ang) => [RELOJ.c + radio * Math.cos(ang), RELOJ.c + radio * Math.sin(ang)]

// Sector de anillo centrado en la hora h; más largo cuanto mayor es el valor
function sector(h, valor) {
  const exterior = RELOJ.base + (valor / 100) * RELOJ.extra
  const medio = (7.5 - 0.8) * (Math.PI / 180)   // media hora menos una separación
  const a0 = anguloHora(h) - medio
  const a1 = anguloHora(h) + medio
  const [x0, y0] = punto(RELOJ.interior, a0)
  const [x1, y1] = punto(exterior, a0)
  const [x2, y2] = punto(exterior, a1)
  const [x3, y3] = punto(RELOJ.interior, a1)
  const f = (n) => n.toFixed(2)
  return {
    d: `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} A${exterior} ${exterior} 0 0 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${RELOJ.interior} ${RELOJ.interior} 0 0 0 ${f(x0)} ${f(y0)} Z`,
    exterior,
  }
}

// Niveles del reloj: colores con contraste sobre fondo blanco y texto legible encima de cada uno
const NIVELES_RELOJ = [
  { hasta: 25, nombre: 'Riesgo bajo', fondo: '#d1fae5', texto: '#065f46', borde: '#6ee7b7' },
  { hasta: 50, nombre: 'Riesgo moderado', fondo: '#fbbf24', texto: '#451a03', borde: '#f59e0b' },
  { hasta: 75, nombre: 'Riesgo alto', fondo: '#f97316', texto: '#431407', borde: '#ea580c' },
  { hasta: 101, nombre: 'Riesgo crítico', fondo: '#dc2626', texto: '#ffffff', borde: '#b91c1c' },
]
const nivelReloj = (v) => NIVELES_RELOJ.find((n) => v <= n.hasta) ?? NIVELES_RELOJ[3]

// Sin globo flotante: el detalle va en el centro del reloj y en la barra de estado de abajo
function RelojRiesgo({ valores, activa, onActiva }) {
  const pico = valores.indexOf(Math.max(...valores))
  const hayDatos = Math.max(...valores) > 0
  const elegida = activa ?? pico
  const nivel = nivelReloj(valores[elegida])
  const anchoInsignia = 12 + nivel.nombre.length * 5.6
  return (
    <svg viewBox="0 0 300 300" className="pg-reloj" role="list" aria-label="Reloj de 24 horas con el nivel de tentación de cada hora">
      {/* Guías: uso bajo y máximo */}
      <circle cx={RELOJ.c} cy={RELOJ.c} r={RELOJ.base} className="pg-reloj__guia" />
      <circle cx={RELOJ.c} cy={RELOJ.c} r={RELOJ.base + RELOJ.extra} className="pg-reloj__guia pg-reloj__guia--max" />
      {valores.map((v, hh) => {
        const { d, exterior } = sector(hh, v)
        const n = nivelReloj(v)
        const [tx, ty] = punto(exterior - 12, anguloHora(hh))
        return (
          <g key={hh} role="listitem">
            <path d={d} fill={n.fondo} stroke={n.borde} tabIndex={0}
              className={`pg-reloj__sector${hh === activa ? ' pg-reloj__sector--activo' : ''}`}
              aria-label={`${hora(hh)}: ${v} % de tentación, ${n.nombre.toLowerCase()}`}
              onMouseEnter={() => onActiva(hh)}
              onMouseLeave={() => onActiva(null)}
              onFocus={() => onActiva(hh)}
              onBlur={() => onActiva(null)}
            />
            {/* Porcentaje visible en las horas que más destacan */}
            {v >= 50 && <text x={tx} y={ty + 3.5} textAnchor="middle" className="pg-reloj__valor" fill={n.texto} aria-hidden="true">{v}</text>}
          </g>
        )
      })}
      {/* Horas guía por fuera */}
      {[0, 6, 12, 18].map((hh) => {
        const [x, y] = punto(RELOJ.base + RELOJ.extra + 14, anguloHora(hh))
        return <text key={hh} x={x} y={y + 4} textAnchor="middle" className="pg-reloj__hora" aria-hidden="true">{String(hh).padStart(2, '0')}h</text>
      })}
      {/* Centro fijo: pico del día en reposo; la hora elegida al pasar el ratón o el teclado */}
      <circle cx={RELOJ.c} cy={RELOJ.c} r={RELOJ.interior - 3} className="pg-reloj__centro" />
      {!hayDatos ? (
        <text x={RELOJ.c} y={RELOJ.c + 4} textAnchor="middle" className="pg-reloj__centro-pie" aria-hidden="true">Sin datos</text>
      ) : activa == null ? (
        <g aria-hidden="true">
          <text x={RELOJ.c} y={RELOJ.c - 16} textAnchor="middle" className="pg-reloj__centro-pie">Pico diario</text>
          <text x={RELOJ.c} y={RELOJ.c + 2} textAnchor="middle" className="pg-reloj__centro-hora">{hora(pico)} hrs</text>
          <text x={RELOJ.c} y={RELOJ.c + 20} textAnchor="middle" className="pg-reloj__centro-riesgo" fill={nivelReloj(valores[pico]).borde}>{valores[pico]}% de riesgo</text>
        </g>
      ) : (
        <g aria-hidden="true">
          <text x={RELOJ.c} y={RELOJ.c - 17} textAnchor="middle" className="pg-reloj__centro-hora">{hora(activa)} hrs</text>
          <text x={RELOJ.c} y={RELOJ.c + 8} textAnchor="middle" className="pg-reloj__centro-valor" fill={nivel.borde}>{valores[activa]}%</text>
          <rect x={RELOJ.c - anchoInsignia / 2} y={RELOJ.c + 15} width={anchoInsignia} height="15" rx="7.5" fill={nivel.fondo} />
          <text x={RELOJ.c} y={RELOJ.c + 25.5} textAnchor="middle" className="pg-reloj__insignia" fill={nivel.texto}>{nivel.nombre}</text>
        </g>
      )}
    </svg>
  )
}

// Pausa sugerida según qué tan intensa es la hora más difícil
const PAUSA_RECOMENDADA = {
  1: 'Aviso suave (5 s)',
  2: 'Respiración breve',
  3: 'Chatbot de apoyo',
}

function RiskCard({ r }) {
  // Hora elegida en el reloj (ratón o teclado); null = reposo
  const [activa, setActiva] = useState(null)
  const [inicio] = r.conDatos ? r.ventana.split('–') : ['23:00']
  const [hh, mm] = inicio.split(':').map(Number)
  const desde = hora(hh, mm)
  const hasta = hora((hh + 2) % 24)
  // Sugerencia: empezar a cuidarse media hora antes de la ventana difícil
  const antes = hora((hh + 23) % 24, 30)

  return (
    <Card
      className="card--riesgo card--legible"
      etiqueta="TUS HORAS DE RIESGO"
      titulo="Mapa de riesgo por hora"
      ayuda={
        <Ayuda
          titulo="Mapa de riesgo por hora"
          que="Un reloj de 24 horas: medianoche arriba, las 06:00 a la derecha, mediodía abajo y las 18:00 a la izquierda. Cada segmento es una hora y su porcentaje es qué tanto usas el celular a esa hora comparado con tu hora de más uso (100 %)."
          accion="Programa el Modo Foco o el horario de descanso justo antes de tus horas más oscuras."
        />
      }
      extra={<Insignia>{r.analizados} usos analizados</Insignia>}
    >
      <div className="riesgo pg-riesgo">
        <div className="riesgo__mapa pg-reloj-caja">
          <RelojRiesgo valores={r.valores} activa={activa} onActiva={setActiva} />
          <div className="pg-reloj-lado">
            <ul className="pg-reloj-leyenda" aria-label="Niveles de riesgo">
              {[...NIVELES_RELOJ].reverse().map((n, i, lista) => (
                <li key={n.nombre}>
                  <i style={{ background: n.fondo, borderColor: n.borde }} />
                  <b>{n.nombre.replace('Riesgo ', '').replace(/^./, (c) => c.toUpperCase())}</b>
                  <span>{i === lista.length - 1 ? '0' : NIVELES_RELOJ[lista.length - 2 - i].hasta + 1}–{Math.min(100, n.hasta)} %</span>
                </li>
              ))}
            </ul>
            <p className="pg-reloj-nota">
              Cada segmento es una hora. Mientras <b>más sale hacia afuera y más oscuro</b>, más usas el celular a esa hora.
            </p>
          </div>
          {/* Barra de estado fija: detalle de la hora elegida, o la ventana más difícil en reposo */}
          <div className="ventana pg-reloj-estado" aria-live="polite">
            {activa == null ? (
              <>
                <span className="punto-color" style={{ background: '#dc2626' }} />
                <span>
                  <b>{r.conDatos ? `Tu ventana más difícil: ${desde} a ${hasta}` : 'Aún no hay una hora difícil'}</b>
                  <small>{r.conDatos ? 'Son las dos horas seguidas con más uso. Pasa el ratón por el reloj para ver cada hora.' : 'Se calcula con tu uso de las apps.'}</small>
                </span>
              </>
            ) : (
              <>
                <span className="punto-color" style={{ background: nivelReloj(r.valores[activa]).fondo, boxShadow: `0 0 0 1px ${nivelReloj(r.valores[activa]).borde}` }} />
                <span>
                  <b>{hora(activa)} a {hora((activa + 1) % 24)} · {r.valores[activa]} % · {nivelReloj(r.valores[activa]).nombre}</b>
                  <small>
                    {r.valores[activa] === 100
                      ? 'Es tu hora de más uso del periodo.'
                      : `Usas el celular un ${r.valores[activa]} % de lo que lo usas en tu hora más difícil.`}
                  </small>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Recomendación corta: banner debajo del reloj */}
        <aside className="pg-recomendacion-corta" aria-label="Recomendación rápida">
          <span className="pg-recomendacion-corta__icono"><Icono src={iconoCerebro} tam={16} /></span>
          <span className="pg-recomendacion-corta__texto">
            <b>Recomendación rápida</b>
            <span>
              {r.conDatos
                ? <>Pico crítico de <b>{desde} a {hasta}</b>. Te sugerimos activar el Modo Descanso a las <b>{antes}</b>.</>
                : 'Cuando tu teléfono envíe uso, aquí verás qué hacer en tu hora más difícil.'}
            </span>
          </span>
          {r.conDatos && <span className="pg-recomendacion-corta__pausa">Pausa: {PAUSA_RECOMENDADA[r.regla.nivel]}</span>}
        </aside>
      </div>
    </Card>
  )
}

// ---------- Tiempo vs. objetivo ----------

// "3h 45m", "45m", "0m"
function hm(min) {
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

// Escala del eje Y en horas: cada 30 min si todo cabe en 3 h, si no cada hora
function escalaHoras(maxMin) {
  const paso = maxMin <= 180 ? 30 : 60
  const tope = Math.max(paso * 2, Math.ceil((maxMin * 1.08) / paso) * paso)
  return { tope, marcas: Array.from({ length: tope / paso + 1 }, (_, i) => i * paso) }
}
const etiquetaHoras = (min) => (min % 60 ? `${Math.floor(min / 60)}h 30` : `${min / 60}h`)

function WeeklyCard({ s }) {
  const { props, globo } = useGlobo({ arriba: true })
  const [activo, setActivo] = useState(null)
  const meta = s.objetivo
  const { tope, marcas } = escalaHoras(Math.max(60, meta ?? 0, ...s.barras.map((b) => b.uso)))
  const alto = (min) => `${Math.min(100, (min / tope) * 100)}%`
  const mejor = s.cambioPct != null && s.cambioPct <= 0
  const hoy = fechaISO(ahoraEnZona())

  return (
    <Card
      className="card--semanal card--legible pg-semanal"
      etiqueta="HÁBITO SEMANAL"
      titulo="Tiempo vs. objetivo"
      ayuda={
        <Ayuda
          titulo="Tiempo vs. objetivo"
          que={meta != null
            ? `Compara las horas de uso diario frente a tu límite objetivo de ${hm(meta)} para identificar días de sobreuso.`
            : 'Compara las horas de uso diario frente a tu límite objetivo para identificar días de sobreuso.'}
          accion="Si un día la barra sale en rojo por encima de la línea de meta, revisa en Uso por app qué subió ese día."
        />
      }
      extra={
        s.cambioPct != null && (
          <span className={`pg-rendimiento pg-rendimiento--${mejor ? 'bien' : 'mal'}`}
            title={mejor ? 'Promedio diario por debajo de tu meta' : 'Promedio diario por encima de tu meta'}>
            {s.cambioPct > 0 ? '+' : '−'}{Math.abs(s.cambioPct).toFixed(1)}%
          </span>
        )
      }
    >
      <ul className="pg-semanal__leyenda">
        <li><i className="pg-semanal__punto pg-semanal__punto--bien" />Dentro de la meta</li>
        <li><i className="pg-semanal__punto pg-semanal__punto--mal" />Por encima del límite</li>
        {meta != null && <li><i className="pg-semanal__linea" />Meta diaria ({hm(meta)})</li>}
      </ul>

      <div className="pg-semana">
        {/* Eje Y en horas */}
        <div className="pg-semana__eje" aria-hidden="true">
          {marcas.map((m) => <span key={m} style={{ bottom: alto(m) }}>{etiquetaHoras(m)}</span>)}
        </div>
        <div className="pg-semana__area">
          <div className="pg-semana__guias" aria-hidden="true">
            {marcas.map((m) => <i key={m} className="pg-semana__guia" style={{ bottom: alto(m) }} />)}
            {/* Línea de meta a su altura exacta */}
            {meta != null && (
              <span className="pg-semana__meta-linea" style={{ bottom: alto(meta) }}>
                <em>Meta</em>
              </span>
            )}
          </div>
          {s.barras.map((b, i) => {
            const esHoy = b.fecha === hoy
            const sinDatos = b.uso <= 0
            const excede = meta != null && b.uso > meta
            const dif = meta != null ? b.uso - meta : null
            const diaLargo = new Date(`${b.fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'long' })
            const titulo = `${diaLargo.charAt(0).toUpperCase()}${diaLargo.slice(1)}${esHoy ? ' (hoy)' : ''}`
            const estado = dif == null ? null : dif > 0 ? `+${hm(dif)} sobre el límite` : `−${hm(dif)} ahorrados`
            const p = props(
              sinDatos ? (
                <>
                  <b>{titulo}</b>
                  <span>Sin actividad registrada</span>
                </>
              ) : (
                <>
                  <span className="pg-globo-dia">{titulo}</span>
                  <b className="pg-globo-uso">{hm(b.uso)}</b>
                  {estado && <span className={`pg-globo-estado pg-globo-estado--${dif > 0 ? 'mal' : 'bien'}`}>{estado}</span>}
                  {esHoy && <span className="pg-globo-nota">Acumulado hasta ahora</span>}
                </>
              ),
            )
            const tipo = sinDatos ? 'vacia' : esHoy ? 'hoy' : excede ? 'mal' : 'bien'
            return (
              <div key={b.fecha} tabIndex={0}
                className={`pg-semana__col${activo === i ? ' pg-semana__col--activa' : ''}`}
                aria-label={sinDatos ? `${titulo}: sin actividad registrada` : `${titulo}: ${hm(b.uso)}${estado ? `, ${estado}` : ''}`}
                {...p}
                // El globo se ancla a la punta de la barra (o a la columna si no hay uso)
                onMouseEnter={(e) => { p.onMouseEnter({ currentTarget: e.currentTarget.querySelector('.pg-semana__barra') ?? e.currentTarget }); setActivo(i) }}
                onMouseLeave={() => { p.onMouseLeave(); setActivo(null) }}
                onFocus={(e) => { p.onFocus({ currentTarget: e.currentTarget.querySelector('.pg-semana__barra') ?? e.currentTarget }); setActivo(i) }}
                onBlur={() => { p.onBlur(); setActivo(null) }}
              >
                <div className="pg-semana__pista">
                  {sinDatos
                    ? <span className="pg-semana__sin" aria-hidden="true">—</span>
                    : <span className={`pg-semana__barra pg-semana__barra--${tipo}`} style={{ height: alto(b.uso) }} />}
                </div>
                <small className={esHoy ? 'pg-semana__hoy' : ''}>{esHoy ? 'Hoy' : b.dia}</small>
              </div>
            )
          })}
        </div>
      </div>

      <p className={`pg-resumen pg-resumen--${s.diferencia == null ? 'neutro' : mejor ? 'bien' : 'mal'}`}>
        <Icono src={iconoPulso} tam={18} tinta={s.diferencia == null ? undefined : mejor ? '#10b981' : '#e11d48'} />
        {s.diferencia == null ? (
          <span>Sin plan activo: crea uno para comparar contra una meta.</span>
        ) : (
          <span>
            <b>{Math.round(Math.abs(s.diferencia))} min {mejor ? 'menos' : 'más'}</b> de uso promedio al día que tu meta.
          </span>
        )}
      </p>
      {globo}
    </Card>
  )
}

// ---------- Uso y frecuencia de sesiones ----------

// Área de la gráfica de frecuencia (unidades del viewBox)
const FREC = { ancho: 480, alto: 190, izq: 36, der: 462, arr: 34, abj: 156 }

// Escala "redonda" del eje Y: 0, 5, 10, 15… o 0, 2, 4… según el máximo
function escalaY(max) {
  const paso = [1, 2, 5, 10, 20, 50, 100].find((p) => max / p <= 4) ?? 100
  // Con pocas aperturas la escala llega al menos a 4, para que se lea
  const tope = Math.max(4, Math.ceil(max / paso) * paso)
  return { tope, marcas: Array.from({ length: tope / paso + 1 }, (_, i) => i * paso) }
}

// Comparación con lo habitual a esa hora del día
function comparacion(sesiones, promedio) {
  const habitual = promedio < 0.5 ? 'casi nunca' : `${promedio.toFixed(1)} en promedio`
  if (sesiones >= promedio * 1.5 && sesiones - promedio >= 2) return { texto: 'Más que tu promedio habitual', habitual, tono: 'alto' }
  if (sesiones <= promedio * 0.5 && promedio - sesiones >= 1) return { texto: 'Menos que tu promedio habitual', habitual, tono: 'bajo' }
  return { texto: 'Dentro de tu promedio habitual', habitual, tono: 'normal' }
}
const aperturasTexto = (n) => `${n} ${n === 1 ? 'apertura' : 'aperturas'}`

function GraficaFrecuencia({ frecuencia }) {
  const { props, globo } = useGlobo()
  const [activa, setActiva] = useState(null)
  const { tope, marcas } = escalaY(Math.max(1, ...frecuencia.map((f) => f.sesiones)))
  const paso = (FREC.der - FREC.izq) / (frecuencia.length - 1)
  const x = (i) => FREC.izq + i * paso
  const y = (v) => FREC.abj - (v / tope) * (FREC.abj - FREC.arr)
  const pts = frecuencia.map((f, i) => [x(i), y(f.sesiones)])
  const linea = curvaSuave(pts)
  const area = `${linea} L${x(frecuencia.length - 1)} ${FREC.abj} L${x(0)} ${FREC.abj} Z`
  const ultimo = frecuencia.length - 1
  const ult = frecuencia[ultimo]
  const etiquetaUltimo = `${ult.sesiones} ${ult.sesiones === 1 ? 'sesión' : 'sesiones'}`
  const anchoEtiqueta = 14 + etiquetaUltimo.length * 6.4

  return (
    <div className="pg-frecuencia">
      <svg viewBox={`0 0 ${FREC.ancho} ${FREC.alto}`} className="pg-frecuencia__svg" role="img"
        aria-label={`Aperturas por hora en las últimas 12 horas. La más reciente, ${hora(ult.hora)}: ${etiquetaUltimo}.`}>
        <defs>
          <linearGradient id="pg-relleno-frecuencia" x1="0" y1={FREC.arr} x2="0" y2={FREC.abj} gradientUnits="userSpaceOnUse">
            <stop stopColor="#f59e0b" stopOpacity="0.32" />
            <stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Escala y líneas guía */}
        {marcas.map((m) => (
          <g key={m}>
            <line x1={FREC.izq} x2={FREC.der} y1={y(m)} y2={y(m)} className={m === 0 ? 'pg-frecuencia__base' : 'pg-frecuencia__guia'} />
            <text x={FREC.izq - 8} y={y(m) + 4} textAnchor="end" className="pg-frecuencia__eje">{m}</text>
          </g>
        ))}
        {activa != null && <line x1={x(activa)} x2={x(activa)} y1={FREC.arr - 6} y2={FREC.abj} className="pg-frecuencia__cursor" />}
        <path d={area} fill="url(#pg-relleno-frecuencia)" />
        <path d={linea} fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {frecuencia.map((f, i) =>
          f.sesiones > 0 && i !== ultimo ? (
            <circle key={i} cx={x(i)} cy={y(f.sesiones)} r={activa === i ? 5 : 3.5} className="pg-frecuencia__punto" />
          ) : null,
        )}
        {/* Punto más reciente con su etiqueta fija */}
        <circle cx={x(ultimo)} cy={y(ult.sesiones)} r="7" className="pg-frecuencia__ultimo" />
        <g transform={`translate(${Math.min(x(ultimo), FREC.ancho - anchoEtiqueta / 2 - 2)} ${y(ult.sesiones) - 18})`}>
          <rect x={-anchoEtiqueta / 2} y="-15" width={anchoEtiqueta} height="20" rx="10" className="pg-frecuencia__insignia" />
          <text x="0" y="-1" textAnchor="middle" className="pg-frecuencia__insignia-texto">{etiquetaUltimo}</text>
        </g>
        {/* Marcas de hora cada 2 h, terminando en la más reciente */}
        {frecuencia.map((f, i) =>
          (ultimo - i) % 2 === 0 ? (
            <text key={i} x={x(i)} y={FREC.abj + 22} textAnchor="middle" className="pg-frecuencia__eje">{hora(f.hora)}</text>
          ) : null,
        )}
        {/* Zonas de cada hora para el ratón y el teclado */}
        {frecuencia.map((f, i) => {
          const c = comparacion(f.sesiones, f.promedio)
          const p = props(
            <>
              <b>{hora(f.hora)} – {hora((f.hora + 1) % 24)}</b>
              <span className="ayuda-globo__fila">Aperturas registradas <b>{f.sesiones}</b></span>
              <span className="ayuda-globo__fila">Lo habitual a esta hora <b>{c.habitual}</b></span>
              <span className={`pg-comparacion pg-comparacion--${c.tono}`}>{c.texto}</span>
            </>,
          )
          return (
            <rect key={i} x={x(i) - paso / 2} y={FREC.arr - 10} width={paso} height={FREC.abj - FREC.arr + 10} className="pg-frecuencia__zona"
              tabIndex={0} aria-label={`${hora(f.hora)}: ${aperturasTexto(f.sesiones)}. ${c.texto}.`}
              {...p}
              onMouseEnter={(e) => { p.onMouseEnter(e); setActiva(i) }}
              onMouseLeave={() => { p.onMouseLeave(); setActiva(null) }}
              onFocus={(e) => { p.onFocus(e); setActiva(i) }}
              onBlur={() => { p.onBlur(); setActiva(null) }}
            />
          )
        })}
      </svg>
      {globo}
    </div>
  )
}

function UsageCard({ u }) {
  let acumulado = 0
  const dona = u.categorias.length
    ? `conic-gradient(${u.categorias
        .map((c) => {
          const tramo = `${c.color} ${acumulado}% ${acumulado + c.porcentaje}%`
          acumulado += c.porcentaje
          return tramo
        })
        .join(', ')}, #e2e8f0 ${acumulado}% 100%)`
    : '#f1f5f9'

  return (
    <Card
      className="card--uso card--legible"
      etiqueta="APPS RESTRINGIDAS"
      titulo="Uso y frecuencia de sesiones"
      ayuda={
        <Ayuda
          titulo="Uso y frecuencia de sesiones"
          que="A la izquierda, cómo se reparte tu tiempo entre tipos de apps en el periodo elegido. A la derecha, cuántas veces abriste apps en cada hora de las últimas 12 horas."
          accion="Si un tipo de app ocupa la mayor parte de la dona, ponle un límite diario en Apps y sitios."
        />
      }
      extra={<Insignia>Actualizado ahora</Insignia>}
    >
      <div className="uso">
        <div className="uso__resumen">
          <div className="dona" style={{ background: dona }} role="img"
            aria-label={`Uso total ${formatoDuracion(u.totalMin)}: ${u.categorias.map((c) => `${c.nombre} ${c.porcentaje} %`).join(', ')}`}>
            <div className="dona__centro">
              <b>{formatoDuracion(u.totalMin)}</b>
              <small>uso total</small>
            </div>
          </div>
          <ul className="leyenda-categorias">
            {u.categorias.map((c) => (
              <li key={c.nombre}>
                <i style={{ background: c.color }} />
                <b>{c.nombre}</b>
                <span>{c.porcentaje} %</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="uso__frecuencia">
          <div className="uso__frecuencia-cabeza">
            <span className="pg-subtitulo">
              <b>Frecuencia de sesiones</b>
              <Ayuda
                titulo="Frecuencia de sesiones"
                que="Muestra cuántas veces abriste el dispositivo en bloques de tiempo durante las últimas 12 horas para detectar picos de uso compulsivo."
                accion="Si ves un pico, pasa el ratón por esa hora: si está por encima de tu promedio habitual, prueba una pausa antes de abrir apps a esa hora."
              />
            </span>
            <small>Aperturas por hora · últimas 12 horas con actividad</small>
          </div>
          <GraficaFrecuencia frecuencia={u.frecuencia} />
        </div>
      </div>
    </Card>
  )
}

// ---------- Pausas preventivas (antes "Intervenciones · Éxito por nivel") ----------

// Qué hace cada nivel de pausa, en palabras simples
const NIVELES_TEXTO = {
  1: { nombre: 'Aviso suave', detalle: 'Temporizador de 5 s' },
  2: { nombre: 'Pausa consciente', detalle: 'Ejercicio de respiración' },
  3: { nombre: 'Bloqueo asistido', detalle: 'Chatbot de apoyo' },
}

function FrictionCard({ f }) {
  const { props, globo } = useGlobo()
  return (
    <Card
      className="card--friccion card--legible"
      etiqueta="EFECTIVIDAD DE LAS PAUSAS"
      titulo="Pausas preventivas y control"
      ayuda={
        <Ayuda
          titulo="Pausas preventivas"
          que="Las pausas preventivas son recordatorios automáticos diseñados para ayudarte a detener el uso impulsivo del dispositivo antes de superar tu meta."
          accion="Si un nivel funciona poco contigo, súbelo para las apps que más te cuestan en Apps y sitios."
        />
      }
      extra={<Insignia>{f.global} % autocontrol</Insignia>}
    >
      <div className="prevenidas">
        <b>{f.prevenidas}</b>
        <span>límites respetados de {f.total} avisos recibidos</span>
        <small>{f.global} % de autocontrol: no abriste la app después de la pausa</small>
      </div>
      <ul className="niveles">
        {f.niveles.map((n) => {
          const t = NIVELES_TEXTO[n.nivel]
          return (
            <li key={n.nivel} tabIndex={0}
              {...props(
                <>
                  <b>Nivel {n.nivel} · {t.nombre}</b>
                  <span>{t.detalle}</span>
                  <span className="ayuda-globo__fila">Veces activado <b>{n.total}</b></span>
                  <span className="ayuda-globo__fila">Efectividad <b>{n.exito} %</b></span>
                  <span>{n.total ? `En ${Math.round((n.exito / 100) * n.total)} de ${n.total} veces no abriste la app.` : 'Aún no se ha mostrado en este periodo.'}</span>
                </>,
              )}
            >
              <span className="niveles__num" style={{ background: n.fondo, color: n.texto }}>{n.nivel}</span>
              <span className="niveles__nombre">
                <b>{t.nombre}</b>
                <small>{t.detalle}</small>
              </span>
              <span className="niveles__pista" aria-hidden="true">
                <span style={{ width: `${n.exito}%` }} />
              </span>
              <span className="niveles__cifra">
                <b>{n.exito} % efectividad</b>
                <small>{n.total} {n.total === 1 ? 'vez activado' : 'veces activado'}</small>
              </span>
            </li>
          )
        })}
      </ul>
      {globo}
    </Card>
  )
}

// ---------- Página ----------

const TARJETAS = [
  { id: 'telemetria', claves: 'telemetria sincronizacion celular android dispositivo señal permisos', C: TelemetryCard, prop: 't', dato: 'telemetria' },
  { id: 'clusteres', claves: 'patrones sesiones rapidas largas cortas aperturas duracion clusteres', C: ClusterCard, prop: 'c', dato: 'clusteres' },
  { id: 'riesgo', claves: 'riesgo recaida hora tentacion recomendacion vulnerable', C: RiskCard, prop: 'r', dato: 'riesgo' },
  { id: 'semanal', claves: 'semanal habito tiempo objetivo plan', C: WeeklyCard, prop: 's', dato: 'semanal' },
  { id: 'uso', claves: 'uso frecuencia sesiones apps categorias', C: UsageCard, prop: 'u', dato: 'uso' },
  { id: 'friccion', claves: 'pausas preventivas control autocontrol friccion intervenciones nivel', C: FrictionCard, prop: 'f', dato: 'friccion' },
]

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PanelGeneral({ panel, busqueda, onRecargar }) {
  const q = normalizar(busqueda.trim())
  return (
    <div className="panel">
      {TARJETAS.map((t) => {
        const Tarjeta = t.C
        return (
          <div key={t.id} className={`panel__celda panel__celda--${t.id}${q && !normalizar(t.claves).includes(q) ? ' panel__celda--atenuada' : ''}`}>
            <Tarjeta {...{ [t.prop]: panel[t.dato] }} onRecargar={onRecargar} />
          </div>
        )
      })}
    </div>
  )
}
