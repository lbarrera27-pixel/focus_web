// Uso por aplicación (Figma e17 a 1440 px, e18 a 1920 px y e19 a 1024 px).
import { useEffect, useMemo, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Banner, Encabezado, EstadoVacio, Esqueleto, Kpi } from '../../components/web/Comunes.jsx'
import { horas, limiteActual } from '../../data/plan.js'
import { DIAS_CORTOS, PERIODOS_USO, cargarAnterior, construirUso, listaDias, rangoDias, rangoTexto } from '../../data/uso.js'
import iconoLuna from '../../assets/icons/w-luna.svg'
import iconoReloj from '../../assets/icons/w-reloj-pico.svg'
import iconoBurbuja from '../../assets/icons/w-uso.svg'
import './Uso.css'

const COLORES_CATEGORIA = ['#b45309', '#0369a1', '#047857', '#94a3b8']
const HORAS_EJE = [0, 3, 6, 9, 12, 15, 18, 21]
const signo = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} %`

function Cambio({ valor }) {
  if (valor == null) return null
  return <span className={`us-cambio us-cambio--${valor > 0 ? 'sube' : 'baja'}`}>{signo(valor)}</span>
}

function MapaCalor({ uso }) {
  return (
    <div className="us-mapa" role="table" aria-label="Minutos de uso por día de la semana y hora">
      <div className="us-mapa__fila us-mapa__horas" role="row">
        <span role="columnheader" />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} role="columnheader">{HORAS_EJE.includes(h) ? String(h).padStart(2, '0') : ''}</span>
        ))}
      </div>
      {uso.celdas.map((fila, d) => (
        <div key={d} className="us-mapa__fila" role="row">
          <b role="rowheader">{DIAS_CORTOS[d]}</b>
          {fila.map((c, h) => (
            <i key={h} role="cell" className={`us-nivel-${c.nivel}`}
              title={`${DIAS_CORTOS[d]} ${h}:00 · ${Math.round(c.min)} min`} aria-label={`${DIAS_CORTOS[d]} ${h}:00, ${Math.round(c.min)} minutos`} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Cargando() {
  return (
    <div className="us-cargando" aria-busy="true">
      <div className="w-fila us-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-tarjeta w-kpi w-kpi--cargando">
            <Esqueleto ancho={90} alto={10} /><Esqueleto ancho={150} alto={26} /><Esqueleto ancho={110} alto={10} />
          </div>
        ))}
      </div>
      <div className="us-cuerpo">
        <section className="w-tarjeta us-apps">{Array.from({ length: 7 }, (_, i) => <Esqueleto key={i} alto={i ? 26 : 34} />)}</section>
        <section className="w-tarjeta us-calor"><Esqueleto alto={220} /><Esqueleto alto={40} /></section>
      </div>
    </div>
  )
}

export default function Uso({ usuario, datos, error, periodo, onPeriodo, onExportar, onRecargar }) {
  const [anteriores, setAnteriores] = useState(null)

  useEffect(() => {
    if (!datos) return
    let vigente = true
    setAnteriores(null)
    cargarAnterior(usuario, datos.desde, datos.hasta)
      .then((ev) => vigente && setAnteriores(ev))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [usuario, datos])

  const uso = useMemo(() => (datos ? construirUso(datos, anteriores) : null), [datos, anteriores])
  const limite = datos?.plan ? limiteActual(datos.plan, datos.ajustes ?? []) : null
  const periodoTexto = { hoy: 'día', '7d': 'semana', '30d': 'mes', semestre: 'semestre' }[periodo] ?? 'periodo'
  const top = uso?.apps[0]

  return (
    <div className="w-pagina us">
      <Encabezado sobretitulo={datos ? `USO · ${rangoTexto(datos.desde, datos.hasta)}` : 'USO'} titulo="Uso por aplicación">
        <div className="us-segmentado" role="radiogroup" aria-label="Periodo">
          {PERIODOS_USO.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={periodo === p.id}
              className={periodo === p.id ? 'us-segmentado__activo' : ''} onClick={() => onPeriodo(p.id)}>
              {p.titulo}
            </button>
          ))}
        </div>
        <button type="button" className="w-boton w-boton--secundario" onClick={onExportar} disabled={!datos}>Exportar</button>
      </Encabezado>

      {error && !datos ? (
        <Banner tono="error" titulo="No pudimos cargar tu uso" detalle={error}
          accion={<button type="button" className="w-boton w-boton--secundario" onClick={onRecargar}>Reintentar</button>} />
      ) : !uso ? (
        <Cargando />
      ) : !uso.apps.length ? (
        <section className="w-tarjeta us-vacio">
          <EstadoVacio icono={iconoBurbuja} titulo="Aún no hay uso en este periodo"
            detalle="Cuando la app de tu teléfono registre tus aperturas, aquí verás cuánto tiempo pasas en cada app."
            accion={periodo === 'semestre' ? null : 'Ver todo el semestre'} onAccion={() => onPeriodo('semestre')} />
        </section>
      ) : (
        <>
          <div className="w-fila us-kpis">
            <Kpi etiqueta="TIEMPO TOTAL" valor={horas(uso.total)}
              detalle={uso.cambioTotal == null ? `en ${uso.dias} día${uso.dias === 1 ? '' : 's'}` : `${signo(uso.cambioTotal)} vs. ${periodoTexto} anterior`} />
            <Kpi etiqueta="PROMEDIO DIARIO" valor={horas(uso.promedio)}
              detalle={limite ? `tu límite: ${horas(limite)}` : 'aún sin plan'} />
            <Kpi etiqueta="APP MÁS USADA" valor={top.nombre}
              detalle={`${horas(top.min)} · ${Math.round((top.min / uso.total) * 100)} % del total`} />
            <Kpi etiqueta="FRANJA MÁS CRÍTICA" valor={uso.franja?.texto ?? '—'}
              detalle={uso.franja ? listaDias(uso.franja.principales) : 'sin datos'} />
          </div>

          <div className="us-cuerpo">
            <section className="w-tarjeta us-apps">
              <div>
                <h2 className="w-titulo-3">Tiempo por app</h2>
                <p className="w-cuerpo w-texto--3">
                  Ordenadas por minutos.{anteriores ? ` La flecha compara con ${periodo === 'hoy' ? 'ayer' : `${periodoTexto === 'semana' ? 'la' : 'el'} ${periodoTexto} anterior`}.` : ''}
                </p>
              </div>
              <ul className="us-lista">
                {uso.apps.map((a) => (
                  <li key={a.numero}>
                    <div className="us-lista__fila">
                      <span className="us-lista__nombre"><b>{a.nombre}</b><small>{a.etiqueta}</small></span>
                      <b className="w-cuerpo">{horas(a.min)}</b>
                      <Cambio valor={a.cambio} />
                    </div>
                    <span className="us-barra"><span style={{ width: `${(a.min / top.min) * 100}%` }} /></span>
                  </li>
                ))}
              </ul>
              <div className="w-divisor" />
              <p className="w-sobretitulo">POR CATEGORÍA</p>
              <span className="us-apilada" aria-hidden="true">
                {uso.categorias.map((c, i) => <span key={c.id} style={{ flexGrow: c.min, background: COLORES_CATEGORIA[Math.min(i, 3)] }} />)}
              </span>
              <ul className="us-categorias">
                {uso.categorias.map((c, i) => (
                  <li key={c.id}>
                    <i style={{ background: COLORES_CATEGORIA[Math.min(i, 3)] }} />
                    <span>{c.nombre}</span>
                    <span className="w-texto--3">{horas(c.min)}</span>
                    <b>{Math.round(c.pct * 100)} %</b>
                  </li>
                ))}
              </ul>
            </section>

            <section className="w-tarjeta us-calor">
              <div className="us-calor__encabezado">
                <div>
                  <h2 className="w-titulo-3">Mapa de calor · día × hora</h2>
                  <p className="w-cuerpo w-texto--3">
                    Minutos de uso en cada hora{uso.dias > 7 ? ' (promedio por semana)' : ''}. Más oscuro = más uso.
                  </p>
                </div>
                {uso.pico && (
                  <b className="us-pico">Pico: {DIAS_CORTOS[uso.pico.d].toLowerCase()} {String(uso.pico.h).padStart(2, '0')}:00 · {Math.round(uso.pico.min)} min</b>
                )}
              </div>
              <MapaCalor uso={uso} />
              <div className="us-leyenda" aria-hidden="true">
                <span>Sin uso</span>
                {[0, 1, 2, 3, 4, 5].map((n) => <i key={n} className={`us-nivel-${n}`} />)}
                <span>48+ min</span>
              </div>
              {uso.franja && (
                <p className="us-lectura">
                  <Icono src={iconoLuna} tam={16} />
                  <span>
                    Tu uso se concentra de {uso.franja.desde} a {uso.franja.hasta} {rangoDias(uso.franja.dias)}. Foqui usa esta franja para sugerir el Modo Foco{Number(uso.franja.desde.slice(0, 2)) >= 20 || Number(uso.franja.desde.slice(0, 2)) < 5 ? ' nocturno' : ''}.
                  </span>
                </p>
              )}
              <div className="w-divisor" />
              <p className="w-sobretitulo">HORAS PICO</p>
              <ul className="us-picos">
                {uso.picos.map((p) => (
                  <li key={`${p.d}-${p.h}`}>
                    <Icono src={iconoReloj} tam={14} />
                    <b>{p.texto}</b>
                    <span>{Math.round(p.min)} min</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
