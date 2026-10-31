// Foqui (Figma e33 tu semana, e34 escribiendo, e35 sin conexión)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { Esqueleto } from '../../components/web/Comunes.jsx'
import { horas } from '../../data/plan.js'
import {
  NIVEL_TEXTO, SUGERENCIAS, cargarSemanas, datosUsados, guardarChat, leerChat, preguntar, resumenRapido, resumenSemana,
  signo, textoSemana,
} from '../../data/foqui.js'
import mascota from '../../assets/foqui/foqui-mascota.png'
import iconoOjo from '../../assets/icons/w-ojo.svg'
import iconoEnviar from '../../assets/icons/w-enviar.svg'
import iconoSi from '../../assets/icons/w-check-10.svg'
import iconoNo from '../../assets/icons/w-x-10.svg'
import iconoAlerta from '../../assets/icons/w-aviso-alerta.svg'
import iconoInfo from '../../assets/icons/w-info-azul.svg'
import iconoMeta from '../../assets/icons/w-meta.svg'
import iconoLuna from '../../assets/icons/w-luna.svg'
import './Foqui.css'

const SABE = [
  [true, 'Minutos totales de la semana'],
  [true, 'Adherencia y racha'],
  [true, 'Cambio del plan y nivel de riesgo'],
  [false, 'Nombres de apps'],
  [false, 'Horarios y eventos individuales'],
]
// Caracteres que aparecen cada 20 ms mientras Foqui "escribe"
const PASO = 3
let siguienteId = 0
const nuevoId = () => `m${Date.now()}-${++siguienteId}`

function Kpi({ etiqueta, valor, detalle }) {
  return (
    <div className="w-tarjeta fq-kpi">
      <p className="w-etiqueta">{etiqueta}</p>
      <p className="w-titulo-2">{valor}</p>
      <p className="w-texto w-texto--2">{detalle}</p>
    </div>
  )
}

function UsoPorDia({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.min))
  return (
    <div className="fq-barras" role="img" aria-label={`Uso por día: ${dias.filter((d) => !d.futuro).map((d) => `${d.etiqueta} ${horas(d.min)}`).join(', ')}`}>
      {dias.map((d) => (
        <div key={d.etiqueta} className={d.hoy ? 'fq-barras__hoy' : d.futuro ? 'fq-barras__futuro' : ''}>
          <b>{d.futuro ? '' : horas(d.min, { corto: d.min >= 60 })}</b>
          <i style={d.futuro ? undefined : { height: `${Math.max(4, (d.min / max) * 70)}px` }} />
          <small>{d.etiqueta}</small>
        </div>
      ))}
    </div>
  )
}

export default function Foqui({ usuario, datos, onNavegar }) {
  const [semanas, setSemanas] = useState(null)
  const [mensajes, setMensajes] = useState(() => leerChat(usuario.id))
  // listo · esperando (la API aún no responde) · escribiendo (se muestra la respuesta poco a poco) · sin_conexion
  const [fase, setFase] = useState('listo')
  const [estadoFoqui, setEstadoFoqui] = useState('Normal')
  const [revelando, setRevelando] = useState(null)
  const [pendiente, setPendiente] = useState(undefined)
  const [texto, setTexto] = useState('')
  const control = useRef(null)
  const lista = useRef(null)
  const saludado = useRef(false)

  const [cargaSemanas, setCargaSemanas] = useState(0)
  useEffect(() => {
    let vigente = true
    cargarSemanas(usuario)
      .then((s) => vigente && setSemanas(s))
      .catch(() => vigente && setSemanas({ eventos: [], riesgo: null, error: true }))
    return () => {
      vigente = false
    }
  }, [usuario, cargaSemanas])
  const sinNumeros = !!semanas?.error

  const resumen = useMemo(() => (semanas ? resumenSemana(semanas, datos) : null), [semanas, datos])

  useEffect(() => {
    guardarChat(usuario.id, mensajes)
    lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [mensajes, usuario.id])

  // Al reintentar, la pregunta ya está en el chat: no se vuelve a agregar ni a mandar en el historial
  const enviar = useCallback(async (mensaje, reintento = false) => {
    const previos = reintento && mensaje ? mensajes.slice(0, -1) : mensajes
    const historial = previos.filter((m) => m.texto).slice(-10).map((m) => ({ rol: m.rol, texto: m.texto.slice(0, 1000) }))
    if (mensaje && !reintento) setMensajes((m) => [...m, { id: nuevoId(), rol: 'usuario', texto: mensaje }])
    setFase('esperando')
    setPendiente(undefined)
    control.current = new AbortController()
    try {
      const r = await preguntar(usuario, mensaje, historial, control.current.signal, resumen)
      const id = nuevoId()
      setEstadoFoqui(r.estado_foqui)
      // El saludo lleva las etiquetas con los datos que usó Foqui
      setMensajes((m) => [...m, { id, rol: 'foqui', texto: r.mensaje, conDatos: !mensaje }])
      setRevelando({ id, hasta: 0 })
      setFase('escribiendo')
    } catch (err) {
      if (err.name === 'AbortError') return setFase('listo')
      setPendiente(mensaje)
      setFase('sin_conexion')
    }
  }, [mensajes, usuario, resumen])

  // Saludo al abrir por primera vez (la demo espera los números para armarlo)
  useEffect(() => {
    if (saludado.current || mensajes.length || (usuario.demo && !resumen)) return
    saludado.current = true
    enviar(null)
  }, [enviar, mensajes.length, usuario.demo, resumen])

  // Efecto "escribiendo": la respuesta aparece poco a poco
  useEffect(() => {
    if (!revelando) return
    const total = mensajes.find((m) => m.id === revelando.id)?.texto.length ?? 0
    if (revelando.hasta >= total) {
      setRevelando(null)
      setFase('listo')
      return
    }
    const t = setTimeout(() => setRevelando((r) => r && { ...r, hasta: r.hasta + PASO }), 20)
    return () => clearTimeout(t)
  }, [revelando, mensajes])

  function detener() {
    if (fase === 'esperando') control.current?.abort()
    if (fase === 'escribiendo' && revelando) {
      // Se queda lo que alcanzó a escribir
      setMensajes((m) => m.map((x) => (x.id === revelando.id ? { ...x, texto: `${x.texto.slice(0, revelando.hasta).trimEnd()}…` } : x)))
      setRevelando(null)
      setFase('listo')
    }
  }

  function alEnviar(e) {
    e.preventDefault()
    const t = texto.trim()
    if (!t || fase !== 'listo') return
    setTexto('')
    enviar(t.slice(0, 500))
  }

  const ocupado = fase === 'esperando' || fase === 'escribiendo'
  const offline = fase === 'sin_conexion'
  const chip = offline ? { texto: 'Sin conexión', tono: 'apagado' }
    : ocupado ? { texto: 'Escribiendo…', tono: 'marca' }
      : { texto: estadoFoqui, tono: { Feliz: 'exito', Cansado: 'indigo', Enfocado: 'cian', Atenta: 'marca' }[estadoFoqui] ?? 'apagado' }

  return (
    <div className="w-pagina fq">
      <header className="w-encabezado__titulos">
        <p className="w-sobretitulo">FOQUI · TU RESUMEN SEMANAL</p>
        <h1 className="w-display">Tu semana con Foqui</h1>
      </header>

      {offline && (
        <div className="fq-aviso" role="alert">
          <Icono src={iconoAlerta} tam={20} />
          <div>
            <b>Foqui no puede responder ahora</b>
            <span>
              {sinNumeros
                ? 'No hay conexión con la nube. Revisa tu internet e inténtalo de nuevo.'
                : `Foqui no respondió. Tus números están al día; ${pendiente ? 'tu pregunta se enviará' : 'el resumen llegará'} cuando vuelva.`}
            </span>
          </div>
          <button type="button" className="w-boton w-boton--secundario"
            onClick={() => { if (sinNumeros) setCargaSemanas((n) => n + 1); enviar(pendiente, true) }}>
            Reintentar
          </button>
        </div>
      )}

      <div className="fq-fila">
        <section className="w-tarjeta fq-chat" aria-label="Conversación con Foqui">
          <div className="fq-quien">
            <span className={`fq-avatar${offline ? ' fq-avatar--apagado' : ''}`}><img src={mascota} alt="" /></span>
            <div>
              <h2 className="w-titulo-3">Foqui</h2>
              <p className="fq-quien__fila">
                <span className={`fq-estado fq-estado--${chip.tono}`} aria-live="polite">
                  {chip.texto === 'Atenta' && <Icono src={iconoOjo} tam={14} />}
                  {chip.texto}
                </span>
                <span className="w-texto w-texto--2">{textoSemana()}</span>
              </p>
            </div>
          </div>

          <div className="fq-mensajes" ref={lista} aria-live="polite">
            {mensajes.map((m) => {
              const visible = revelando?.id === m.id ? m.texto.slice(0, revelando.hasta) : m.texto
              return (
                <div key={m.id} className={`fq-msj fq-msj--${m.rol}`}>
                  <div className="fq-burbuja">
                    <p>
                      {visible}
                      {revelando?.id === m.id && <span className="fq-cursor" aria-hidden="true" />}
                    </p>
                    {m.conDatos && resumen && revelando?.id !== m.id && datosUsados(resumen).length > 0 && (
                      <div className="fq-datos">{datosUsados(resumen).map((d) => <span key={d}>{d}</span>)}</div>
                    )}
                  </div>
                </div>
              )
            })}
            {fase === 'esperando' && (
              <div className="fq-msj fq-msj--foqui">
                <div className="fq-burbuja fq-burbuja--puntos" aria-label="Foqui está escribiendo"><i /><i /><i /></div>
              </div>
            )}

            {offline && resumen && (
              <div className="fq-caida">
                {!sinNumeros && <div className="fq-rapido">
                  <p><Icono src={iconoInfo} tam={16} /><b>Resumen rápido con tus números</b></p>
                  <ul>{resumenRapido(resumen).map((t) => <li key={t}>{t}</li>)}</ul>
                </div>}
                <p className="w-texto w-texto--3">Lo que pasó antes de la caída sigue guardado. Cuando Foqui vuelva, continuará la conversación aquí.</p>
                <div className="w-divisor" />
                <p className="w-sobretitulo">MIENTRAS FOQUI VUELVE</p>
                <button type="button" className="fq-ir" onClick={() => onNavegar('plan')}>
                  <span><Icono src={iconoMeta} tam={16} /></span>
                  <span><b>Revisa tu plan</b><small>Tu límite y tu avance siguen al día en «Mi plan».</small></span>
                </button>
                <button type="button" className="fq-ir" onClick={() => onNavegar('apps')}>
                  <span><Icono src={iconoLuna} tam={16} /></span>
                  <span><b>Activa el Modo Foco</b><small>Funciona aunque Foqui no esté disponible.</small></span>
                </button>
              </div>
            )}
          </div>

          {ocupado ? (
            <div className="fq-detener">
              <button type="button" className="w-boton w-boton--secundario" onClick={detener}>Detener respuesta</button>
            </div>
          ) : !offline && (
            <div className="fq-sugerencias">
              {SUGERENCIAS.map((s) => <button key={s} type="button" onClick={() => enviar(s)}>{s}</button>)}
            </div>
          )}

          <form className={`fq-composer${ocupado || offline ? ' fq-composer--bloqueado' : ''}`} onSubmit={alEnviar}>
            <input value={texto} maxLength={500} disabled={ocupado || offline} aria-label="Mensaje para Foqui"
              placeholder={offline ? 'Foqui no está disponible. Puedes reintentar arriba.' : ocupado ? 'Espera a que Foqui termine o detén la respuesta…' : 'Escribe a Foqui…'}
              onChange={(e) => setTexto(e.target.value)} />
            <button type="submit" aria-label="Enviar" disabled={!texto.trim() || ocupado || offline}>
              <img src={iconoEnviar} alt="" />
            </button>
          </form>
        </section>

        <aside className="fq-lateral">
          {resumen && !sinNumeros ? (
            <div className="fq-kpis">
              <Kpi etiqueta="PROMEDIO DIARIO" valor={horas(resumen.promedio)}
                detalle={resumen.cambio == null ? 'esta semana' : `${signo(resumen.cambio)} % vs. semana anterior`} />
              <Kpi etiqueta="ADHERENCIA" valor={resumen.adherencia == null ? '—' : `${Math.round(resumen.adherencia * 100)} %`}
                detalle={resumen.adherencia == null ? 'aún sin semana cerrada' : `${Math.round(resumen.adherencia * 7)} de 7 días`} />
              <Kpi etiqueta="AJUSTE DEL PLAN" valor={resumen.cambioPlan == null ? '—' : `${signo(resumen.cambioPlan)} %`} detalle="según tu semana" />
              <Kpi etiqueta="RIESGO" valor={resumen.riesgo ? NIVEL_TEXTO[resumen.riesgo.nivel] : '—'}
                detalle={resumen.riesgo ? `${Math.round(resumen.riesgo.probabilidad * 100)} % para la próxima semana` : 'aún sin datos'} />
            </div>
          ) : (
            <div className="fq-kpis" aria-busy="true">
              {[0, 1, 2, 3].map((i) => <div key={i} className="w-tarjeta fq-kpi"><Esqueleto ancho={90} alto={10} /><Esqueleto ancho={110} alto={22} /></div>)}
            </div>
          )}

          <section className="w-tarjeta fq-sabe">
            <h2 className="w-titulo-3">Lo que Foqui sabe de ti</h2>
            <p className="w-texto w-texto--2">Foqui solo pone en palabras estos números; no decide tu plan ni tu riesgo.</p>
            <ul>
              {SABE.map(([si, t]) => (
                <li key={t}>
                  <span className={si ? 'fq-si' : 'fq-no'}><img src={si ? iconoSi : iconoNo} alt="" /></span>
                  {si ? 'Sí recibe' : 'Nunca recibe'}: {t}
                </li>
              ))}
            </ul>
          </section>

          <section className="w-tarjeta fq-semana">
            <p className="w-sobretitulo">TU SEMANA</p>
            <h2 className="w-titulo-3">Uso por día</h2>
            {resumen && !sinNumeros ? <UsoPorDia dias={resumen.dias} />
              : sinNumeros ? <p className="w-cuerpo w-texto--3">Sin conexión: tu uso aparecerá aquí al reintentar.</p>
                : <Esqueleto alto={110} />}
          </section>
        </aside>
      </div>
    </div>
  )
}
