// Mi plan (Figma e9 plan y ajustes, e10 editar plan, e11 sin semana completa, e12 cargando).
import { useEffect, useMemo, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Banner, Barra, Encabezado, EstadoVacio, Esqueleto, Kpi } from '../../components/web/Comunes.jsx'
import { ADHERENCIA, IGNORADAS, REGLAS, inferir, trapecio } from '../../data/difuso.js'
import { fechaISO } from '../../data/panel.js'
import {
  DIA_MS_PLAN, cargarPreferencias, fechaLarga, horas, ignoradasSemana, inicioSemana, limiteActual, ordenar, porcentaje,
} from '../../data/plan.js'
import EditarPlan from './EditarPlan.jsx'
import iconoBaja from '../../assets/icons/w-baja.svg'
import iconoIgual from '../../assets/icons/w-igual.svg'
import iconoSube from '../../assets/icons/w-sube.svg'
import iconoInfoVerde from '../../assets/icons/w-info-verde.svg'
import iconoInfoAzul from '../../assets/icons/w-info-azul.svg'
import iconoBurbuja from '../../assets/icons/w-plan-burbuja.svg'
import iconoLuna from '../../assets/icons/w-luna.svg'
import iconoMeta from '../../assets/icons/w-meta.svg'
import iconoCheck from '../../assets/icons/w-check.svg'
import './MiPlan.css'

const NOMBRE = { baja: 'Baja', regular: 'Regular', buena: 'Buena', excelente: 'Excelente', pocas: 'Pocas', muchas: 'Muchas' }
const SALIDA = {
  reducir_mucho: 'Reducir mucho (−10 %)', reducir_poco: 'Reducir poco (−5 %)', mantener: 'Mantener (0 %)', relajar: 'Relajar (+5 %)',
}
const COLORES = {
  baja: { color: '#b91c1c' }, regular: { color: '#b45309', punteada: true }, buena: { color: '#0369a1' },
  excelente: { color: '#047857', punteada: true }, pocas: { color: '#047857' }, muchas: { color: '#b91c1c', punteada: true },
}
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ---------- Funciones de pertenencia (mismos conjuntos que app/utils/reglas_plan.py) ----------
function GraficaPertenencia({ titulo, conjuntos, valor }) {
  const ancho = 500
  const alto = 120
  const linea = (params) => {
    const pts = []
    for (let i = 0; i <= 200; i++) {
      const x = i / 200
      pts.push(`${x * ancho},${(1 - trapecio(x, ...params)) * (alto - 2) + 1}`)
    }
    return pts.join(' ')
  }
  return (
    <section className="w-tarjeta mp-pertenencia">
      <div className="mp-pertenencia__titulo">
        <h2 className="w-titulo-3">{titulo}</h2>
        <span className="mp-chip">{Math.round(valor * 100)} %</span>
      </div>
      <div className="mp-pertenencia__grafica">
        <svg viewBox={`0 0 ${ancho} ${alto}`} preserveAspectRatio="none" role="img"
          aria-label={`${titulo}: ${Math.round(valor * 100)} %`}>
          <line x1="0" x2={ancho} y1={alto - 0.5} y2={alto - 0.5} className="mp-eje" />
          {Object.entries(conjuntos).map(([nombre, params]) => (
            <polyline key={nombre} points={linea(params)} className="mp-conjunto"
              style={{ stroke: COLORES[nombre].color, strokeDasharray: COLORES[nombre].punteada ? '5 4' : undefined }} />
          ))}
        </svg>
        <span className="mp-valor" style={{ left: `${valor * 100}%` }} aria-hidden="true" />
      </div>
      <div className="mp-eje-x">{['0 %', '25 %', '50 %', '75 %', '100 %'].map((t) => <span key={t}>{t}</span>)}</div>
      <ul className="mp-leyenda">
        {Object.entries(conjuntos).map(([nombre, params]) => (
          <li key={nombre}>
            <i className={COLORES[nombre].punteada ? 'mp-leyenda__punteada' : ''} style={{ '--c': COLORES[nombre].color }} />
            {NOMBRE[nombre]} · {Math.round(trapecio(valor, ...params) * 100)} %
          </li>
        ))}
      </ul>
    </section>
  )
}

function Historial({ ajustes, proximo }) {
  return (
    <section className="w-tarjeta mp-historial">
      <h2 className="w-titulo-3">Historial de ajustes</h2>
      <ul>
        {[...ajustes].reverse().slice(0, 6).map((a) => {
          const tono = a.cambio_pct < 0 ? 'baja' : a.cambio_pct > 0 ? 'sube' : 'igual'
          return (
            <li key={a.semana}>
              <span>Semana {a.semana}</span>
              <b className={`mp-cambio mp-cambio--${tono}`}>
                <Icono src={{ baja: iconoBaja, sube: iconoSube, igual: iconoIgual }[tono]} tam={14} />
                {porcentaje(a.cambio_pct)}
              </b>
            </li>
          )
        })}
      </ul>
      <div className="mp-aviso mp-aviso--exito">
        <Icono src={iconoInfoVerde} tam={16} />
        <span>
          <b className="w-cuerpo">Próximo ajuste: {proximo.fecha} · 00:00</b>
          <span className="w-texto w-texto--2">{proximo.detalle}</span>
        </span>
      </div>
    </section>
  )
}

// ---------- e9 ----------
function ConAjustes({ plan, ajustes, pausas, prefs }) {
  const ultimo = ajustes[ajustes.length - 1]
  const ign = ignoradasSemana(plan, ultimo.semana, pausas)
  const inf = inferir(ultimo.adherencia, ign)
  const limite = limiteActual(plan, ajustes)
  const anterior = limiteActual(plan, ajustes.slice(0, -1))
  const nivelAdh = Object.entries(inf.pertenencia).sort((a, b) => b[1] - a[1])[0][0]
  const nivelIgn = inf.pertenenciaIgn.muchas > inf.pertenenciaIgn.pocas ? 'muchas' : 'pocas'
  const siguiente = inicioSemana(plan, plan.semana_actual + 1)
  const proyectado = Math.max(prefs.meta_min, limite * (1 + ultimo.cambio_pct / 100))

  return (
    <>
      <div className="w-fila">
        <Kpi etiqueta="LÍMITE ACTUAL" valor={horas(limite)} detalle={`al día, desde ${limite === anterior ? 'el inicio del plan' : `el ${fechaLarga(inicioSemana(plan, ultimo.semana + 1)).split(',')[0]}`}`} />
        <Kpi etiqueta="CAMBIO DE ESTA SEMANA" valor={porcentaje(ultimo.cambio_pct)}
          detalle={`adherencia ${NOMBRE[nivelAdh].toLowerCase()}, ${nivelIgn} pausas ignoradas`} />
        <Kpi etiqueta="AVANCE DEL PLAN" valor={`Semana ${Math.min(plan.semana_actual + 1, prefs.semanas)} de ${prefs.semanas}`}
          detalle={`meta final: ${horas(prefs.meta_min)}`} />
      </div>

      <div className="w-fila">
        <GraficaPertenencia titulo="Adherencia" conjuntos={ADHERENCIA} valor={inf.adherencia} />
        <GraficaPertenencia titulo="Pausas ignoradas" conjuntos={IGNORADAS} valor={inf.ignoradas} />
      </div>

      <div className="w-fila mp-cuerpo">
        <section className="w-tarjeta mp-reglas">
          <table>
            <thead>
              <tr><th>SI ADHERENCIA ES</th><th>Y PAUSAS IGNORADAS</th><th>ENTONCES</th><th>FUERZA</th></tr>
            </thead>
            <tbody>
              {inf.reglas.map((r, i) => (
                <tr key={i} className={r.fuerza > 0 ? 'mp-reglas__activa' : ''}>
                  <td>{NOMBRE[REGLAS[i][0]]}</td>
                  <td>{REGLAS[i][1] ? NOMBRE[REGLAS[i][1]] : 'Cualquiera'}</td>
                  <td>{SALIDA[REGLAS[i][2]]}</td>
                  <td>
                    <span className="mp-fuerza"><span style={{ width: `${r.fuerza * 100}%` }} /></span>
                    <b>{r.fuerza.toFixed(2)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mp-salida">
            <span>Cambio final de tu límite →</span>
            <b>{porcentaje(ultimo.cambio_pct)}</b>
            {prefs.sensibilidad !== 'normal' && <span className="w-texto w-texto--3">(sensibilidad «{prefs.sensibilidad}»)</span>}
          </p>
        </section>
        <Historial
          ajustes={ajustes}
          proximo={{
            fecha: siguiente.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }).replace(',', ''),
            detalle: `Tu límite ${proyectado < limite ? 'bajará' : proyectado > limite ? 'subirá' : 'se quedará en'} ${proyectado === limite ? horas(limite) : `a ${horas(proyectado)}`} si mantienes esta semana.`,
          }}
        />
      </div>
    </>
  )
}

// ---------- e11 ----------
function PrimeraSemana({ plan, eventos, onEditar }) {
  const inicio = inicioSemana(plan, 1)
  const hoy = new Date()
  const limite = plan.limite_base
  const dias = DIAS.map((_, i) => {
    const fecha = new Date(inicio.getTime() + i * DIA_MS_PLAN)
    const nombre = DIAS[(fecha.getDay() + 6) % 7]
    const iso = fechaISO(fecha)
    const min = eventos.filter((e) => fechaISO(new Date(e.inicio)) === iso).reduce((s, e) => s + e.duracion_seg, 0) / 60
    return { nombre, min, conDatos: fecha <= hoy && min > 0 }
  })
  const conDatos = dias.filter((d) => d.conDatos)
  const tope = Math.max(limite * 1.3, ...dias.map((d) => d.min))
  const promedio = conDatos.length ? conDatos.reduce((s, d) => s + d.min, 0) / conDatos.length : 0
  const cumplidos = conDatos.filter((d) => d.min <= limite).length
  const corte = inicioSemana(plan, 2)
  const faltan = Math.max(1, Math.ceil((corte - hoy) / DIA_MS_PLAN))

  return (
    <>
      <Banner titulo="Tu primera semana está en curso"
        detalle={`El primer ajuste se calcula el ${fechaLarga(corte)} a las 00:00. Faltan ${faltan} día${faltan === 1 ? '' : 's'}.`} />
      <div className="w-fila mp-cuerpo">
        <section className="w-tarjeta mp-vacio">
          <EstadoVacio icono={iconoBurbuja} titulo="Aún no hay ajustes"
            detalle="Necesitamos una semana completa de tu uso y tus pausas para proponer tu primer cambio."
            accion="Ver cómo funciona" onAccion={onEditar} />
          <div className="w-divisor" />
          <p className="w-sobretitulo">MIENTRAS TANTO</p>
          {[
            { icono: iconoLuna, titulo: 'Prueba el Modo Foco esta noche', detalle: 'Ayuda a que tu primera semana salga mejor.' },
            { icono: iconoMeta, titulo: 'Revisa tu meta final', detalle: 'Puedes cambiarla antes del primer ajuste.' },
            { icono: iconoCheck, titulo: 'Deja que la app registre tu uso', detalle: 'Mantén el teléfono con internet.' },
          ].map((c) => (
            <div key={c.titulo} className="mp-consejo">
              <span className="mp-consejo__icono"><Icono src={c.icono} tam={16} /></span>
              <span><b className="w-cuerpo">{c.titulo}</b><span className="w-texto w-texto--3">{c.detalle}</span></span>
            </div>
          ))}
        </section>

        <section className="w-tarjeta mp-registro">
          <div>
            <h2 className="w-titulo-3">Lo que ya registramos</h2>
            <p className="w-cuerpo w-texto--3">{conDatos.length} de 7 días con datos. Tu límite de partida es {horas(limite)}.</p>
          </div>
          <ul className="mp-dias">
            {dias.map((d) => {
              const paso = d.min > limite
              return (
                <li key={d.nombre}>
                  <b>{d.nombre}</b>
                  <span className="mp-dias__barra">
                    {d.conDatos && <span className={paso ? 'mp-dias__paso' : ''} style={{ width: `${(d.min / tope) * 100}%` }} />}
                  </span>
                  <span className={`mp-dias__texto${d.conDatos ? (paso ? ' mp-dias__texto--paso' : ' mp-dias__texto--ok') : ''}`}>
                    {d.conDatos ? `${horas(d.min, { corto: true })} · ${paso ? 'se pasó' : 'cumplió'}` : 'sin datos'}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="w-divisor" />
          <p className="w-sobretitulo">PROMEDIO DE ESTOS {conDatos.length} DÍAS</p>
          <div className="w-fila mp-promedios">
            <div>
              <span className="w-etiqueta">USO DIARIO</span>
              <b className="w-titulo-2">{conDatos.length ? horas(promedio) : '—'}</b>
              <Barra valor={promedio / tope} />
            </div>
            <div>
              <span className="w-etiqueta">DÍAS CUMPLIDOS</span>
              <b className="w-titulo-2">{cumplidos} de {conDatos.length}</b>
              <span className="mp-barra-verde"><Barra valor={conDatos.length ? cumplidos / conDatos.length : 0} /></span>
            </div>
          </div>
          <div className="mp-aviso mp-aviso--info">
            <Icono src={iconoInfoAzul} tam={16} />
            <span>
              <b className="w-cuerpo">Faltan {faltan} día{faltan === 1 ? '' : 's'}</b>
              <span className="w-texto w-texto--2">El {fechaLarga(corte)} verás tu primer ajuste.</span>
            </span>
          </div>
        </section>
      </div>
    </>
  )
}

// ---------- e12 ----------
function Cargando() {
  const barras = [22, 45, 88, 88, 45, 22, 22, 65, 92, 65]
  return (
    <div className="mp-cargando" aria-busy="true">
      <div className="w-fila">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-tarjeta w-kpi w-kpi--cargando">
            <Esqueleto ancho={84} alto={10} /><Esqueleto ancho={140} alto={22} /><Esqueleto ancho={110} alto={10} />
          </div>
        ))}
      </div>
      <div className="w-fila">
        {['Adherencia', 'Pausas ignoradas'].map((t) => (
          <section key={t} className="w-tarjeta mp-pertenencia">
            <div className="mp-pertenencia__titulo"><h2 className="w-titulo-3">{t}</h2><Esqueleto ancho={44} alto={20} /></div>
            <div className="mp-barras-cargando">{barras.map((h, i) => <Esqueleto key={i} alto={h} />)}</div>
            <div className="mp-eje-cargando">{[0, 1, 2, 3].map((i) => <Esqueleto key={i} ancho={70} alto={10} />)}</div>
          </section>
        ))}
      </div>
      <section className="w-tarjeta mp-reglas mp-reglas--cargando">
        <table>
          <thead><tr><th>SI ADHERENCIA ES</th><th>Y PAUSAS IGNORADAS</th><th>ENTONCES</th><th>FUERZA</th></tr></thead>
          <tbody>
            {[0, 1, 2, 3].map((i) => (
              <tr key={i}>{[0, 1, 2, 3].map((j) => <td key={j}><Esqueleto alto={10} /></td>)}</tr>
            ))}
          </tbody>
        </table>
        <Esqueleto /><Esqueleto /><Esqueleto />
      </section>
    </div>
  )
}

export default function MiPlan({ usuario, datos, error, onRecargar }) {
  const [editando, setEditando] = useState(false)
  const [prefs, setPrefs] = useState(null)
  const plan = datos?.plan ?? null
  const ajustes = useMemo(() => ordenar(datos?.ajustes ?? []), [datos])

  useEffect(() => {
    if (!datos) return
    let vigente = true
    cargarPreferencias(usuario, datos.plan).then((p) => vigente && setPrefs(p))
    return () => {
      vigente = false
    }
  }, [usuario, datos])

  if (editando && prefs) {
    return (
      <EditarPlan
        usuario={usuario}
        plan={plan}
        ajustes={ajustes}
        pausas={datos.pausas}
        prefs={prefs}
        onCancelar={() => setEditando(false)}
        onGuardado={(nuevas) => {
          setPrefs(nuevas)
          setEditando(false)
          onRecargar()
        }}
      />
    )
  }

  const cargando = !datos || !prefs
  return (
    <div className="w-pagina mp">
      <Encabezado sobretitulo="MI PLAN · AJUSTE SEMANAL" titulo="Plan y ajustes semanales">
        {cargando && !error ? (
          <span className="mp-calculando" role="status">Calculando con los datos de la semana…</span>
        ) : (
          plan && <button type="button" className="w-boton w-boton--secundario" onClick={() => setEditando(true)}>Editar plan</button>
        )}
      </Encabezado>

      {error && !datos ? (
        <Banner tono="error" titulo="No pudimos cargar tu plan" detalle={error}
          accion={<button type="button" className="w-boton w-boton--secundario" onClick={onRecargar}>Reintentar</button>} />
      ) : cargando ? (
        <Cargando />
      ) : !plan ? (
        <section className="w-tarjeta mp-sin-plan">
          <EstadoVacio icono={iconoBurbuja} titulo="Aún no tienes un plan"
            detalle="Elige tu límite de partida y tu meta final. Cada semana Focus! ajustará tu límite según cómo te fue."
            accion="Crear mi plan" onAccion={() => setEditando(true)} />
        </section>
      ) : ajustes.length ? (
        <ConAjustes plan={plan} ajustes={ajustes} pausas={datos.pausas} prefs={prefs} />
      ) : (
        <PrimeraSemana plan={plan} eventos={datos.eventos} onEditar={() => setEditando(true)} />
      )}
    </div>
  )
}
