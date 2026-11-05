// Mi plan (Figma e9 plan y ajustes, e10 editar plan, e11 sin semana completa, e12 cargando).
import { useEffect, useMemo, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Banner, Barra, Encabezado, EstadoVacio, Esqueleto, Kpi } from '../../components/web/Comunes.jsx'
import Ayuda from '../../components/web/Ayuda.jsx'
import { inferir } from '../../data/difuso.js'
import { fechaISO, fechaServidor } from '../../data/panel.js'
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
import { hora } from '../../data/preferencias.js'
import { ahoraEnZona } from '../../data/preferencias.js'
import './MiPlan.css'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ---------- Textos sencillos (sin jerga del motor de reglas) ----------
const NIVEL_CUMPLIMIENTO = {
  excelente: 'Excelente', buena: 'Bueno', regular: 'Regular · Estable', baja: 'Por mejorar',
}
const FRASE_CUMPLIMIENTO = {
  excelente: 'Cumpliste tu horario casi todos los días',
  buena: 'Cumpliste bien con tus horarios',
  regular: 'Cumpliste tu horario algunos días',
  baja: 'Te costó mantenerte dentro de tu horario',
}
// Una razón por regla del motor, contada como la viviría la persona
const RAZONES = {
  'excelente-pocas': { titulo: 'Gran semana', texto: 'Cumpliste tu horario y atendiste las pausas, así que tu límite baja un poco más rápido.' },
  'excelente-muchas': { titulo: 'Buen horario, pausas pendientes', texto: 'Cumpliste tu horario, pero dejaste pasar varias pausas; por eso el límite baja solo un poco.' },
  'buena-pocas': { titulo: 'Buen manejo de pausas', texto: 'Como no ignoraste las alertas, tu límite se redujo ligeramente para ayudarte a avanzar.' },
  'buena-muchas': { titulo: 'Pausas por mejorar', texto: 'Tu horario fue bueno, pero ignoraste varias pausas; el límite se mantiene para no presionarte.' },
  'regular-': { titulo: 'Horarios regulares', texto: 'Al mantener tu ritmo general estable, consolidamos tu tiempo actual sin cambios bruscos.' },
  'baja-': { titulo: 'Semana difícil', texto: 'Te pasaste de tu límite varios días; lo relajamos un poco para que vuelva a ser alcanzable.' },
}
const EFECTO = {
  reducir_mucho: { texto: 'Baja tu límite', tono: 'baja' },
  reducir_poco: { texto: 'Baja tu límite', tono: 'baja' },
  mantener: { texto: 'Lo mantiene', tono: 'igual' },
  relajar: { texto: 'Lo relaja', tono: 'sube' },
}
const tonoPct = (v) => (v >= 0.8 ? 'bien' : v >= 0.55 ? 'medio' : 'mal')

// Anillo de progreso (0–1)
function Anillo({ valor, tono, children }) {
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <div className={`mp-anillo mp-anillo--${tono}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="mp-anillo__pista" />
        <circle cx="50" cy="50" r={r} className="mp-anillo__valor"
          strokeDasharray={`${c * Math.max(0, Math.min(1, valor))} ${c}`} transform="rotate(-90 50 50)" />
      </svg>
      <div className="mp-anillo__centro">{children}</div>
    </div>
  )
}

function Medidor({ titulo, ayuda, valor, tono, centro, nivel, mensaje }) {
  return (
    <section className="w-tarjeta mp-medidor">
      <div className="mp-medidor__titulo">
        <h2 className="w-titulo-3">{titulo}</h2>
        <Ayuda titulo={titulo} que={ayuda} />
      </div>
      <div className="mp-medidor__cuerpo">
        <Anillo valor={valor} tono={tono}>{centro}</Anillo>
        <div className="mp-medidor__texto">
          <span className={`mp-nivel mp-nivel--${tono}`}>{nivel}</span>
          <p>{mensaje}</p>
        </div>
      </div>
    </section>
  )
}

function Historial({ ajustes, proximo }) {
  const lista = [...ajustes].reverse().slice(0, 6)
  return (
    <section className="w-tarjeta mp-historial">
      <h2 className="w-titulo-3">Historial y próximo ajuste</h2>
      <ol className="mp-linea">
        {lista.map((a) => {
          const tono = a.cambio_pct < 0 ? 'baja' : a.cambio_pct > 0 ? 'sube' : 'igual'
          const estado = { baja: 'Disminución aplicada', sube: 'Límite relajado', igual: 'Límite mantenido' }[tono]
          return (
            <li key={a.semana} className={`mp-linea__item mp-linea__item--${tono}`}>
              <i aria-hidden="true" />
              <span>
                <b>Semana {a.semana}</b>
                <small>{estado}</small>
              </span>
              <b className={`mp-cambio mp-cambio--${tono}`}>
                <Icono src={{ baja: iconoBaja, sube: iconoSube, igual: iconoIgual }[tono]} tam={14} />
                {porcentaje(a.cambio_pct)}
              </b>
            </li>
          )
        })}
      </ol>
      <div className="mp-aviso mp-aviso--exito">
        <Icono src={iconoInfoVerde} tam={16} />
        <span>
          <b className="w-cuerpo">Próxima actualización: {proximo.fecha} · {hora(0)} hrs</b>
          <span className="w-texto w-texto--2">{proximo.detalle}</span>
        </span>
      </div>
    </section>
  )
}

// Días de la semana evaluada que quedaron dentro del límite (sin uso cuenta como cumplido, igual que el servidor)
// La ventana son los 7 días previos a la fecha del ajuste (o al fin de esa semana del plan si no la trae).
function diasCumplidos(plan, ajuste, limite, eventos = []) {
  const f = ajuste.fecha
  const fin = !f ? inicioSemana(plan, ajuste.semana + 1)
    : f.length === 10 ? new Date(`${f}T00:00:00`) : fechaServidor(f)
  const inicio = new Date(fin.getTime() - 7 * DIA_MS_PLAN)
  const hoy = ahoraEnZona()
  let cumplidos = 0
  let total = 0
  for (let i = 0; i < 7; i++) {
    const fecha = new Date(inicio.getTime() + i * DIA_MS_PLAN)
    if (fecha > hoy) break
    const iso = fechaISO(fecha)
    const min = eventos.filter((e) => fechaISO(new Date(e.inicio)) === iso).reduce((s, e) => s + e.duracion_seg, 0) / 60
    total += 1
    if (min <= limite) cumplidos += 1
  }
  return { cumplidos, total }
}

// Pausas de la semana evaluada: total e ignoradas
function pausasSemana(plan, semana, pausas = []) {
  const desde = inicioSemana(plan, semana).getTime()
  const hasta = desde + 7 * DIA_MS_PLAN
  const lista = pausas.filter((p) => {
    const t = fechaServidor(p.fecha).getTime()
    return t >= desde && t < hasta
  })
  return { total: lista.length, ignoradas: lista.filter((p) => p.ignorada).length }
}

// ---------- e9 ----------
function ConAjustes({ plan, ajustes, pausas, eventos, prefs }) {
  const ultimo = ajustes[ajustes.length - 1]
  const ign = ignoradasSemana(plan, ultimo.semana, pausas)
  const inf = inferir(ultimo.adherencia, ign)
  const limite = limiteActual(plan, ajustes)
  const anterior = limiteActual(plan, ajustes.slice(0, -1))
  const nivelAdh = Object.entries(inf.pertenencia).sort((a, b) => b[1] - a[1])[0][0]
  const siguiente = inicioSemana(plan, plan.semana_actual + 1)
  const proyectado = Math.max(prefs.meta_min, limite * (1 + ultimo.cambio_pct / 100))
  const semanaActual = Math.min(plan.semana_actual + 1, prefs.semanas)
  const avance = semanaActual / prefs.semanas

  const dias = diasCumplidos(plan, ultimo, ultimo.uso_meta ?? anterior, eventos)
  const conteo = pausasSemana(plan, ultimo.semana, pausas)
  const atendidas = conteo.total ? 1 - conteo.ignoradas / conteo.total : 1
  const frasePausas = !conteo.total
    ? 'no hubo pausas que atender'
    : conteo.ignoradas === 0 ? 'atendiste todas las pausas'
      : atendidas >= 0.75 ? 'atendiste casi todas las pausas' : 'dejaste pasar varias pausas'

  const razones = inf.reglas
    .filter((r) => r.fuerza > 0)
    .sort((a, b) => b.fuerza - a.fuerza)
    .slice(0, 3)
  const totalFuerza = razones.reduce((s, r) => s + r.fuerza, 0) || 1
  const difMin = Math.round(limite - anterior)
  const resultado = difMin < 0
    ? `Reducción de ${Math.abs(difMin)} min (${porcentaje(ultimo.cambio_pct)}) en tu límite diario. Es un ritmo constante y sostenible.`
    : difMin > 0
      ? `Tu límite sube ${difMin} min (${porcentaje(ultimo.cambio_pct)}) para que vuelva a ser alcanzable.`
      : 'Tu límite se mantiene igual esta semana para que consolides el ritmo.'

  return (
    <>
      <div className="w-fila">
        <Kpi etiqueta="TU LÍMITE ACTUAL" valor={horas(limite)}
          detalle={limite === anterior ? 'al día · desde el inicio del plan' : `al día · activo desde el ${fechaLarga(inicioSemana(plan, ultimo.semana + 1)).split(',')[0]}`} />
        <div className="w-tarjeta w-kpi mp-kpi">
          <p className="w-etiqueta">AJUSTE DE ESTA SEMANA</p>
          <p className={`w-display mp-kpi__cambio mp-kpi__cambio--${ultimo.cambio_pct < 0 ? 'baja' : ultimo.cambio_pct > 0 ? 'sube' : 'igual'}`}>
            {porcentaje(ultimo.cambio_pct)}
          </p>
          <p className="w-texto w-texto--2 mp-kpi__detalle">{FRASE_CUMPLIMIENTO[nivelAdh]} y {frasePausas}.</p>
        </div>
        <div className="w-tarjeta w-kpi mp-kpi">
          <p className="w-etiqueta">PROGRESO DEL PROGRAMA</p>
          <p className="w-display">Semana {semanaActual} de {prefs.semanas}</p>
          <span className="mp-progreso"><Barra valor={avance} /><small>{Math.round(avance * 100)} %</small></span>
          <p className="w-texto w-texto--2">Meta objetivo: {horas(prefs.meta_min)} / día</p>
        </div>
      </div>

      <div className="w-fila">
        <Medidor
          titulo="Cumplimiento del horario"
          ayuda="Mide qué tan fielmente mantuviste tu uso dentro de tu límite diario durante la semana."
          valor={inf.adherencia}
          tono={tonoPct(inf.adherencia)}
          centro={<><b>{Math.round(inf.adherencia * 100)}%</b><small>cumplido</small></>}
          nivel={`Nivel: ${NIVEL_CUMPLIMIENTO[nivelAdh]}`}
          mensaje={dias.total
            ? `Respetaste tu horario en ${dias.cumplidos} de los últimos ${dias.total} días.`
            : 'Aún no hay días completos en esta semana.'}
        />
        <Medidor
          titulo="Atención a los recordatorios"
          ayuda="Indica cuántas veces te detuviste cuando la app te sugirió tomar un respiro."
          valor={atendidas}
          tono={conteo.total ? tonoPct(atendidas) : 'neutro'}
          centro={conteo.total
            ? <><b>{Math.round(atendidas * 100)}%</b><small>atendidas</small></>
            : <><Icono src={iconoCheck} tam={22} /><small>sin pausas</small></>}
          nivel={conteo.total ? `${conteo.ignoradas} de ${conteo.total} ignoradas` : 'Sin recordatorios'}
          mensaje={!conteo.total
            ? 'Esta semana la app no necesitó sugerirte pausas.'
            : conteo.ignoradas === 0
              ? '¡Excelente! No omitiste ninguna de las pausas preventivas.'
              : `Atendiste ${conteo.total - conteo.ignoradas} de ${conteo.total} pausas. Intenta detenerte en la siguiente.`}
        />
      </div>

      <div className="w-fila mp-cuerpo">
        <section className="w-tarjeta mp-calculo">
          <div className="mp-medidor__titulo">
            <h2 className="w-titulo-3">¿Cómo calculamos tu nuevo límite?</h2>
            <Ayuda titulo="¿Cómo calculamos tu nuevo límite?"
              que="Tu nuevo límite se calcula automáticamente equilibrando tu tiempo en pantalla y tu respuesta a los recordatorios de descanso." />
          </div>
          <ol className="mp-razones">
            {razones.map((r, i) => {
              const razon = RAZONES[`${r.adherencia}-${r.ignoradas ?? ''}`]
              const efecto = EFECTO[r.salida]
              const peso = r.fuerza / totalFuerza
              return (
                <li key={r.numero} className="mp-razon">
                  <span className="mp-razon__num">{i + 1}</span>
                  <span className="mp-razon__texto">
                    <b>{razon.titulo}</b>
                    <span>{razon.texto}</span>
                  </span>
                  <span className="mp-razon__chips">
                    <span className={`mp-efecto mp-efecto--${efecto.tono}`}>{efecto.texto}</span>
                    <small>{peso >= 0.6 ? 'Influencia principal' : 'Influencia leve'}</small>
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="mp-resultado">
            <b>Resultado final:</b> {resultado}
            {prefs.sensibilidad !== 'normal' && <small> Ritmo elegido: {prefs.sensibilidad}.</small>}
          </p>
        </section>
        <Historial
          ajustes={ajustes}
          proximo={{
            fecha: (() => {
              const t = siguiente.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric' }).replace(',', '')
              return t.charAt(0).toUpperCase() + t.slice(1)
            })(),
            detalle: proyectado === limite
              ? `Si mantienes este ritmo, tu límite se quedará en ${horas(limite)}.`
              : `Si mantienes este ritmo durante los próximos días, tu límite ${proyectado < limite ? 'bajará' : 'subirá'} a ${horas(proyectado)}, según lo planeado.`,
          }}
        />
      </div>
    </>
  )
}

// ---------- e11 ----------
function PrimeraSemana({ plan, eventos, onEditar }) {
  const inicio = inicioSemana(plan, 1)
  const hoy = ahoraEnZona()
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
        detalle={`El primer ajuste se calcula el ${fechaLarga(corte)} a las ${hora(0)}. Faltan ${faltan} día${faltan === 1 ? '' : 's'}.`} />
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
        {['Cumplimiento del horario', 'Atención a los recordatorios'].map((t) => (
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
        <ConAjustes plan={plan} ajustes={ajustes} pausas={datos.pausas} eventos={datos.eventos} prefs={prefs} />
      ) : (
        <PrimeraSemana plan={plan} eventos={datos.eventos} onEditar={() => setEditando(true)} />
      )}
    </div>
  )
}
