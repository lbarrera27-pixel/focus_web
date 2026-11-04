import Card, { Insignia } from '../components/Card.jsx'
import Icono from '../components/Icono.jsx'
import iconoTelefono from '../assets/icons/phone.svg'
import iconoCheck from '../assets/icons/check.svg'
import iconoMovil from '../assets/icons/mobile-client.svg'
import iconoNube from '../assets/icons/cloud-ingestion.svg'
import iconoAnalytics from '../assets/icons/analytics.svg'
import iconoFlecha from '../assets/icons/arrow-head.svg'
import iconoCerebro from '../assets/icons/brain.svg'
import iconoPulso from '../assets/icons/pulse.svg'
import { formatoDuracion, nivelRiesgo } from '../data/panel.js'
import { GRUPO_CATEGORIA } from '../data/ajustes.js'
import { horas } from '../data/plan.js'
import { hora } from '../data/preferencias.js'
import Ayuda, { useGlobo } from '../components/web/Ayuda.jsx'
import './PanelGeneral.css'

// ---------- Telemetría ----------

function TelemetryCard({ t }) {
  return (
    <Card
      className="card--telemetria"
      etiqueta="ANDROID CLOUD SYNC"
      titulo="Telemetry Pipeline"
      extra={<Insignia vivo={t.servicioActivo}>{t.servicioActivo ? 'EN VIVO' : 'SIN SEÑAL'}</Insignia>}
    >
      <div className="dispositivo">
        <span className="dispositivo__icono">
          <Icono src={iconoTelefono} tam={23} />
        </span>
        <span className="dispositivo__texto">
          <b>{t.dispositivo}</b>
          <small>{t.detalle}</small>
        </span>
        {t.vinculado ? (
          <span className="vinculado">
            <Icono src={iconoCheck} tam={12} /> Vinculado
          </span>
        ) : (
          <span className="vinculado vinculado--no">Sin vincular</span>
        )}
      </div>

      <dl className="metricas3">
        <div>
          <dt>SERVICIO</dt>
          <dd>
            <span className={`punto ${t.servicioActivo ? 'punto--ok' : 'punto--off'}`} />
            {t.servicioActivo ? 'Background activo' : 'Sin actividad 24 h'}
          </dd>
        </div>
        <div>
          <dt>HEARTBEAT</dt>
          <dd>{t.heartbeat}</dd>
        </div>
        <div>
          <dt>EVENTOS</dt>
          <dd>{t.eventos} eventos</dd>
        </div>
      </dl>

      <div className="pipeline">
        {t.nodos.map((n, i) => (
          <div className="pipeline__paso" key={n.titulo}>
            {i > 0 && (
              <span className="pipeline__flecha" aria-hidden="true">
                <span className="pipeline__linea" />
                <Icono src={iconoFlecha} tam={12.5} />
              </span>
            )}
            <div className="pipeline__nodo">
              <Icono src={[iconoMovil, iconoNube, iconoAnalytics][i]} tam={16} />
              <b>{n.titulo}</b>
              <small>{n.dato}</small>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------- Patrones de uso (antes "Clústeres") ----------

const ANCHO_D = 568
const ALTO_D = 151
const EJE = { izq: 103, der: 487, arr: 13, abj: 129 }

// Nombre en lenguaje cotidiano para cada grupo, según la categoría de sus apps
const HABITOS = {
  social: { titulo: 'Sesiones rápidas · Redes sociales', resumen: 'entradas rápidas a redes', detalle: 'Uso frecuente de pocos minutos.' },
  mensajeria: { titulo: 'Revisión frecuente · Mensajes', resumen: 'revisiones breves de mensajes', detalle: 'Aperturas constantes y breves.' },
  video: { titulo: 'Sesiones largas · Streaming y videos', resumen: 'sesiones largas de video', detalle: 'Pocas aperturas, pero de larga duración.' },
  juegos: { titulo: 'Partidas · Juegos', resumen: 'partidas de juegos', detalle: 'Sesiones de juego de duración media.' },
}
const habito = (nombre) =>
  HABITOS[GRUPO_CATEGORIA(nombre)] ?? { titulo: `Otras apps · ${nombre}`, resumen: `uso de ${nombre.toLowerCase()}`, detalle: 'Apps de otra categoría.' }

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
    return { ...g, ...habito(g.nombre), minSesion: promedio(pts.map((p) => p.duracionMedia)), aperturasDia: promedio(pts.map((p) => p.aperturas)) }
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
  const resumenGrupo = (g) => (
    <>
      <b>{g.titulo}</b>
      <span>{g.detalle}</span>
      <span className="ayuda-globo__fila">Minutos por sesión <b>{minutosTexto(g.minSesion)}</b></span>
      <span className="ayuda-globo__fila">Veces abierta al día <b>{g.aperturasDia.toFixed(1)}</b></span>
    </>
  )

  return (
    <Card
      className="card--clusteres card--legible"
      etiqueta="HÁBITOS POR APLICACIÓN · PERIODO ELEGIDO"
      titulo="Tus patrones de uso"
      ayuda={
        <Ayuda
          titulo="Tus patrones de uso"
          que="Agrupa tus apps según cómo las usas: cada punto es una app en un día. Más arriba = la abriste más veces; más a la derecha = tus sesiones duraron más."
          accion="Si un grupo de sesiones largas ocupa mucho, pon un límite de tiempo a esas apps; si son muchas entradas rápidas, activa la pausa antes de abrirlas."
        />
      }
      extra={
        <div className="cifra-header">
          <b>{c.total.toLocaleString('es-MX')}</b>
          <small>usos registrados</small>
        </div>
      }
    >
      <div className="clusteres">
        <svg className="dispersion" viewBox={`0 0 ${ANCHO_D} ${ALTO_D}`} role="img" aria-label="Tus apps según cuántas veces las abres y cuánto duran tus sesiones">
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
            const [app, fecha] = p.app.split(' · ')
            const dia = new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
            return (
              <circle key={p.id} className="pg-punto" cx={x} cy={y} r={r} fill={g.color}
                {...props(
                  <>
                    <b>{app}</b>
                    <span>{g.titulo} · {dia}</span>
                    <span className="ayuda-globo__fila">Minutos por sesión <b>{minutosTexto(p.duracionMedia)}</b></span>
                    <span className="ayuda-globo__fila">Veces abierta ese día <b>{p.aperturas}</b></span>
                  </>,
                )}
              />
            )
          })}
          <text x="96" y="70" textAnchor="end" className="dispersion__eje">Veces abierta</text>
          <text x="295" y="148" textAnchor="middle" className="dispersion__eje">Minutos por sesión →</text>
          {!c.puntos.length && (
            <text x="295" y="72" textAnchor="middle" className="dispersion__vacio">Sin uso en el periodo</text>
          )}
        </svg>

        <ul className="leyenda-clusteres">
          {grupos.map((g) => (
            <li key={g.letra} tabIndex={0} {...props(resumenGrupo(g))}>
              <span className="punto-color" style={{ background: g.color }} />
              <span>
                <b>{g.titulo}</b>
                <small><strong>{g.porcentaje} %</strong> de tus aperturas: {g.resumen}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {globo}
    </Card>
  )
}

// ---------- Mapa de riesgo por hora ----------

// Pausa sugerida según qué tan intensa es la hora más difícil
const PAUSA_RECOMENDADA = {
  1: 'Aviso suave (temporizador de 5 s)',
  2: 'Ejercicio de respiración breve',
  3: 'Bloqueo asistido con chatbot de apoyo',
}

function RiskCard({ r }) {
  const { props, globo } = useGlobo()
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
          que="Cada casilla es una hora del día. El número es qué tanto usas el celular a esa hora comparado con tu hora de más uso (100 %). Más oscuro = más tentación."
          accion="Programa el Modo Foco o el horario de descanso justo antes de tus horas más oscuras."
        />
      }
      extra={<Insignia>{r.analizados} usos analizados</Insignia>}
    >
      <div className="riesgo">
        <div className="riesgo__mapa">
          <div className="escala" aria-hidden="true">
            <small>Poca tentación</small>
            {['#f1f5f9', '#fde68a', '#fb923c', '#c2410c'].map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
            <small>Mucha</small>
          </div>
          <div className="horas" role="list" aria-label="Nivel de tentación por hora">
            {r.valores.map((v, h) => {
              const n = nivelRiesgo(v)
              return (
                <div key={h} role="listitem" tabIndex={0} className="hora" style={{ background: n.fondo, color: n.texto }}
                  aria-label={`Hora ${hora(h)}, nivel de tentación ${v} %`}
                  {...props(
                    <>
                      <span className="ayuda-globo__fila">Hora <b>{hora(h)}</b></span>
                      <span className="ayuda-globo__fila">Nivel de tentación/riesgo <b>{v} %</b></span>
                    </>,
                  )}
                >
                  <b>{v}</b>
                  <small>{String(h).padStart(2, '0')}</small>
                </div>
              )
            })}
          </div>
          <div className="ventana">
            <span className="punto-color" style={{ background: '#ea580c' }} />
            <span>
              <b>{r.conDatos ? `Tu ventana más difícil: ${desde} a ${hasta}` : 'Aún no hay una hora difícil'}</b>
              <small>{r.conDatos ? 'Son las dos horas seguidas con más uso.' : 'Se calcula con tu uso de las apps.'}</small>
            </span>
          </div>
        </div>

        <aside className="pg-recomendacion" aria-label="Recomendación personalizada">
          <div className="pg-recomendacion__cabeza">
            <span className="pg-recomendacion__icono"><Icono src={iconoCerebro} tam={16} /></span>
            <span>
              <small>RECOMENDACIÓN PERSONALIZADA</small>
              <b>Tu momento más vulnerable</b>
            </span>
          </div>
          {r.conDatos ? (
            <>
              <p>
                Detectamos que <b>entre las {desde} y las {hasta}</b> es cuando más usas el celular, y ahí es más fácil pasarte de tu límite diario.
              </p>
              <p className="pg-recomendacion__sugerencia">
                Te sugerimos activar el <b>modo descanso</b> o limitar las apps de ocio a partir de las <b>{antes}</b>.
              </p>
              <span className="pg-recomendacion__pausa">
                Pausa recomendada: <b>{PAUSA_RECOMENDADA[r.regla.nivel]}</b>
              </span>
            </>
          ) : (
            <p>Cuando tu teléfono envíe uso, aquí verás a qué hora te cuesta más y qué hacer.</p>
          )}
        </aside>
      </div>
      {globo}
    </Card>
  )
}

// ---------- Tiempo vs. objetivo ----------

function WeeklyCard({ s }) {
  const { props, globo } = useGlobo()
  const max = Math.max(1, ...s.barras.flatMap((b) => [b.uso, b.objetivo ?? 0])) / 0.9
  const mejor = s.cambioPct != null && s.cambioPct <= 0
  return (
    <Card
      className="card--semanal card--legible"
      etiqueta="HÁBITO SEMANAL"
      titulo="Tiempo vs. objetivo"
      ayuda={
        <Ayuda
          titulo="Tiempo vs. objetivo"
          que="Compara cada día de la última semana tu tiempo en apps (barra naranja) con la meta diaria de tu plan (barra gris). La insignia es cuánto estás, en promedio, por debajo (−) o por encima (+) de la meta."
          accion="Si varios días rebasas la meta, revisa en Uso por app cuáles apps suben más y ponles un límite."
        />
      }
      extra={
        s.cambioPct != null && (
          <span className={`insignia${mejor ? '' : ' insignia--alerta'}`} title={mejor ? 'Promedio por debajo de la meta' : 'Promedio por encima de la meta'}>
            {s.cambioPct > 0 ? '+' : '−'}
            {Math.abs(s.cambioPct).toFixed(1)} %
          </span>
        )
      }
    >
      <div className="leyenda-barras">
        <span><i className="leyenda-barras__uso" />Uso real</span>
        <span><i className="leyenda-barras__meta" />Meta</span>
      </div>
      <div className="barras">
        {s.barras.map((b, i) => {
          const dif = b.objetivo != null ? Math.round(b.uso - b.objetivo) : null
          return (
            <div className="barras__dia" key={i}>
              <div className="barras__par" tabIndex={0}
                aria-label={`${b.dia}: ${horas(b.uso)} de uso${b.objetivo != null ? `, meta ${horas(b.objetivo)}` : ''}`}
                {...props(
                  <>
                    <b>{b.dia}</b>
                    <span className="ayuda-globo__fila">Tiempo usado <b>{horas(b.uso)}</b></span>
                    {b.objetivo != null && (
                      <>
                        <span className="ayuda-globo__fila">Meta <b>{horas(b.objetivo)}</b></span>
                        <span className="ayuda-globo__fila">Diferencia <b>{dif > 0 ? '+' : dif < 0 ? '−' : ''}{Math.abs(dif)} min</b></span>
                      </>
                    )}
                  </>,
                )}
              >
                <span className="barra barra--objetivo" style={{ height: `${((b.objetivo ?? 0) / max) * 100}%` }} />
                <span className={`barra barra--uso${dif > 0 ? ' barra--excede' : ''}`} style={{ height: `${(b.uso / max) * 100}%` }} />
              </div>
              <small>{b.dia}</small>
            </div>
          )
        })}
      </div>
      <p className="nota">
        <Icono src={iconoPulso} tam={14} />
        {s.diferencia == null ? (
          <span>Sin plan activo: crea uno para comparar contra una meta.</span>
        ) : (
          <span>
            <b className={mejor ? 'ok' : 'alerta'}>{Math.round(Math.abs(s.diferencia))} min {mejor ? 'menos' : 'más'}</b> de uso promedio al día que tu meta.
          </span>
        )}
      </p>
      {globo}
    </Card>
  )
}

// ---------- Uso ----------

function lineaFrecuencia(frecuencia) {
  const x0 = 5.62
  const x1 = 455.27
  const yArr = 23.96
  const yAbj = 136.17
  const max = Math.max(1, ...frecuencia.map((f) => f.sesiones))
  const pts = frecuencia.map((f, i) => [
    x0 + (i / (frecuencia.length - 1)) * (x1 - x0),
    yAbj - 0.08 * (yAbj - yArr) - (f.sesiones / max) * 0.92 * (yAbj - yArr),
  ])
  const linea = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const pico = pts[frecuencia.findIndex((f) => f.sesiones === max)] ?? pts[0]
  return { linea, area: `${linea} V${yAbj} H${x0} Z`, pico }
}

function UsageCard({ u }) {
  const { linea, area, pico } = lineaFrecuencia(u.frecuencia)
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
  const marcas = [0, 4, 8, 11].map((i) => `${String(u.frecuencia[i].hora).padStart(2, '0')}h`)

  return (
    <Card className="card--uso" etiqueta="APPS RESTRINGIDAS" titulo="Uso y Frecuencia de Sesiones" extra={<Insignia>Actualizado ahora</Insignia>}>
      <div className="uso">
        <div className="uso__resumen">
          <div className="dona" style={{ background: dona }}>
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
                <span>{c.porcentaje}%</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="uso__frecuencia">
          <div className="uso__frecuencia-cabeza">
            <b>Frecuencia de sesiones</b>
            <small>Últimas 12 horas con actividad</small>
          </div>
          <svg viewBox="0 0 460.886 144.991" className="tendencia" role="img" aria-label="Tendencia de frecuencia de sesiones">
            <defs>
              <linearGradient id="relleno-tendencia" x1="0" y1="23.96" x2="0" y2="136.17" gradientUnits="userSpaceOnUse">
                <stop stopColor="#F59E0B" stopOpacity="0.25" />
                <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M5.62 25.22H455.27M5.62 69.34H455.27M5.62 113.47H455.27" stroke="#EDF1F5" strokeWidth="1.19" />
            <path d={area} fill="url(#relleno-tendencia)" />
            <path d={linea} fill="none" stroke="#F59E0B" strokeWidth="2.98" strokeLinejoin="round" />
            <ellipse cx={pico[0]} cy={pico[1]} rx="5.62" ry="6.3" fill="white" stroke="#F59E0B" strokeWidth="2.38" />
          </svg>
          <div className="tendencia__horas">
            {marcas.map((m, i) => (
              <small key={i}>{m}</small>
            ))}
          </div>
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
  { id: 'telemetria', claves: 'telemetria android dispositivo heartbeat pipeline', C: TelemetryCard, prop: 't', dato: 'telemetria' },
  { id: 'clusteres', claves: 'patrones habitos clusteres comportamiento aperturas redes mensajes videos', C: ClusterCard, prop: 'c', dato: 'clusteres' },
  { id: 'riesgo', claves: 'riesgo recaida hora tentacion recomendacion vulnerable', C: RiskCard, prop: 'r', dato: 'riesgo' },
  { id: 'semanal', claves: 'semanal habito tiempo objetivo plan', C: WeeklyCard, prop: 's', dato: 'semanal' },
  { id: 'uso', claves: 'uso frecuencia sesiones apps categorias', C: UsageCard, prop: 'u', dato: 'uso' },
  { id: 'friccion', claves: 'pausas preventivas control autocontrol friccion intervenciones nivel', C: FrictionCard, prop: 'f', dato: 'friccion' },
]

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PanelGeneral({ panel, busqueda }) {
  const q = normalizar(busqueda.trim())
  return (
    <div className="panel">
      {TARJETAS.map((t) => {
        const Tarjeta = t.C
        return (
          <div key={t.id} className={`panel__celda panel__celda--${t.id}${q && !normalizar(t.claves).includes(q) ? ' panel__celda--atenuada' : ''}`}>
            <Tarjeta {...{ [t.prop]: panel[t.dato] }} />
          </div>
        )
      })}
    </div>
  )
}
