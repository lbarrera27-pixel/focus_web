// Sitios bloqueados (Figma e24 lista, e25 vacía, e26 validación, e27 quitar, e28 deshacer)
import { useCallback, useEffect, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import Dialogo from '../../components/web/Dialogo.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import { EstadoVacio, Esqueleto } from '../../components/web/Comunes.jsx'
import { haceCuanto } from '../../data/panel.js'
import {
  SITIOS_DEMO, SUGERENCIAS, actualizarSitio, cargarSitios, crearSitio, eliminarSitio, horarios, mananaISO,
  pausasVencidas, resumenSitios, validar,
} from '../../data/sitios.js'
import iconoGlobo from '../../assets/icons/w-globo.svg'
import iconoPapelera from '../../assets/icons/w-papelera.svg'
import iconoPapeleraRoja from '../../assets/icons/w-papelera-roja.svg'
import iconoTelefono from '../../assets/icons/w-telefono.svg'
import iconoInfo from '../../assets/icons/w-info-azul.svg'
import iconoLuna from '../../assets/icons/w-luna.svg'
import iconoMeta from '../../assets/icons/w-meta.svg'
import iconoMas from '../../assets/icons/aj-mas.svg'
import './Sitios.css'

const plural = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`

function Cargando() {
  return (
    <div className="si" aria-busy="true">
      <section className="w-tarjeta si-lista">
        <Esqueleto ancho={180} alto={20} />
        <Esqueleto alto={44} />
        {[0, 1, 2, 3].map((i) => <Esqueleto key={i} alto={40} />)}
      </section>
      <section className="w-tarjeta si-lado"><Esqueleto alto={160} /><Esqueleto alto={60} /></section>
    </div>
  )
}

export default function TabSitios({ usuario, locales, guardarSitios, ultimaSync }) {
  const avisar = useAvisos()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ texto: '', horario: 'siempre' })
  const [errorCampo, setErrorCampo] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [quitando, setQuitando] = useState(null)

  const config = usuario.demo ? { ...SITIOS_DEMO, ...locales.sitios } : locales.sitios
  const opciones = horarios(locales.modoFoco)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      setDatos(await cargarSitios(usuario))
    } catch (err) {
      setError(err.message || 'Sin conexión')
    }
  }, [usuario])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Las pausas "hasta mañana" que ya vencieron se reactivan al abrir la pestaña
  const [revisado, setRevisado] = useState(false)
  useEffect(() => {
    if (!datos || revisado) return
    setRevisado(true)
    const vencidas = pausasVencidas(datos.dominios, config)
    if (!vencidas.length) return
    Promise.all(vencidas.map((s) => actualizarSitio(usuario, s.numero, { activo: true })))
      .then((nuevos) => setDatos((d) => ({ ...d, dominios: d.dominios.map((s) => nuevos.find((n) => n.numero === s.numero) ?? s) })))
      .catch(() => {})
  }, [datos, revisado, config, usuario])

  // Ejecuta una acción; si falla, aviso de error con "Reintentar" (Figma e32)
  async function intentar(accion, exito) {
    setOcupado(true)
    try {
      await accion()
      if (exito) avisar(exito)
    } catch (err) {
      avisar({
        id: 'sitios-error',
        tono: 'error',
        titulo: 'No se pudo guardar',
        detalle: `${err.message || 'Sin conexión'}. Tu teléfono sigue con la lista anterior.`,
        accion: { texto: 'Reintentar', alPulsar: () => intentar(accion, exito) },
      })
    } finally {
      setOcupado(false)
    }
  }

  // Se aplica sobre lo último guardado, no sobre este render: los "Deshacer" se pulsan después
  const conConfig = (dominio, cambios) => (sitios) => {
    const base = usuario.demo ? { ...SITIOS_DEMO, ...sitios } : sitios
    const actual = { ...(base[dominio] ?? {}), ...cambios }
    for (const k of Object.keys(actual)) if (actual[k] == null) delete actual[k]
    return { ...sitios, [dominio]: actual }
  }

  const reemplazar = (sitio) => setDatos((d) => ({ ...d, dominios: d.dominios.map((s) => (s.numero === sitio.numero ? sitio : s)) }))
  const detalleTelefono = usuario.demo ? 'Demo: solo se guarda en este navegador.' : 'Se aplicará en tu teléfono en unos segundos.'

  function anadir(texto, horario) {
    const r = validar(texto, datos.dominios)
    if (r.error) {
      setErrorCampo(r.error)
      return
    }
    setErrorCampo(null)
    intentar(async () => {
      const nuevo = await crearSitio(usuario, r.dominio)
      setDatos((d) => ({ ...d, dominios: [...d.dominios, nuevo] }))
      setForm((f) => ({ ...f, texto: '' }))
      // El horario se guarda aunque sea "Siempre" para no heredar el de una vez anterior
      await guardarSitios(conConfig(r.dominio, { horario, pausaHasta: null }))
    }, { tono: 'exito', titulo: `${r.dominio} bloqueado`, detalle: detalleTelefono })
  }

  function cambiarHorario(sitio, horario) {
    intentar(() => guardarSitios(conConfig(sitio.dominio, { horario })), {
      tono: 'exito', titulo: 'Horario actualizado', detalle: `${sitio.dominio}: ${opciones.find((o) => o.id === horario).texto}`,
    })
  }

  function pausar(sitio, pausa) {
    intentar(async () => {
      reemplazar(await actualizarSitio(usuario, sitio.numero, { activo: !pausa }))
      await guardarSitios(conConfig(sitio.dominio, { pausaHasta: pausa ? mananaISO() : null }))
    }, pausa
      ? { tono: 'info', titulo: `${sitio.dominio} en pausa hasta mañana`, detalle: 'Vuelve a bloquearse solo a medianoche.', accion: { texto: 'Deshacer', alPulsar: () => pausar(sitio, false) } }
      : { tono: 'exito', titulo: `${sitio.dominio} vuelve a estar bloqueado`, detalle: detalleTelefono })
  }

  function quitar(sitio) {
    setQuitando(null)
    intentar(async () => {
      await eliminarSitio(usuario, sitio.numero)
      setDatos((d) => ({ ...d, dominios: d.dominios.filter((s) => s.numero !== sitio.numero) }))
    }, {
      tono: 'exito',
      titulo: `${sitio.dominio} se quitó de la lista`,
      detalle: usuario.demo ? 'Demo: solo se guarda en este navegador.' : 'Tu teléfono se actualizará en unos segundos.',
      // Figma e28: se vuelve a crear con el mismo horario y estado
      accion: {
        texto: 'Deshacer',
        alPulsar: () => intentar(async () => {
          let nuevo = await crearSitio(usuario, sitio.dominio)
          if (!sitio.activo) nuevo = await actualizarSitio(usuario, nuevo.numero, { activo: false })
          setDatos((d) => ({ ...d, dominios: [...d.dominios, nuevo] }))
        }, { tono: 'exito', titulo: `${sitio.dominio} vuelve a la lista` }),
      },
    })
  }

  if (error && !datos) {
    return (
      <div className="si si--una">
        <section className="w-tarjeta si-lista">
          <EstadoVacio icono={iconoGlobo} titulo="No pudimos cargar tus sitios" detalle={error} accion="Reintentar" onAccion={cargar} />
        </section>
      </div>
    )
  }
  if (!datos) return <Cargando />

  const vista = resumenSitios(datos, config)
  const sugerencias = SUGERENCIAS.filter((s) => !datos.dominios.some((d) => d.dominio === s)).slice(0, 4)
  const masUsado = vista.top[0]

  return (
    <div className="si">
      <section className="w-tarjeta si-lista">
        <div>
          <h2 className="w-titulo-3">Sitios bloqueados</h2>
          <p className="w-cuerpo w-texto--3">Se bloquean en el navegador de tu teléfono.</p>
        </div>

        <form className="si-anadir" noValidate onSubmit={(e) => { e.preventDefault(); anadir(form.texto, form.horario) }}>
          <label className={`w-campo si-anadir__sitio${errorCampo ? ' w-campo--error' : ''}`}>
            <span>Sitio web</span>
            <span className="si-entrada">
              <Icono src={iconoGlobo} tam={16} />
              <input value={form.texto} placeholder="ejemplo.com" maxLength={300} autoComplete="off" spellCheck={false}
                aria-invalid={!!errorCampo} aria-describedby={errorCampo ? 'si-error' : undefined}
                onChange={(e) => { setForm((f) => ({ ...f, texto: e.target.value })); setErrorCampo(null) }} />
            </span>
          </label>
          <label className="w-campo si-anadir__horario">
            <span>Horario</span>
            <select value={form.horario} onChange={(e) => setForm((f) => ({ ...f, horario: e.target.value }))}>
              {opciones.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
            </select>
          </label>
          <button type="submit" className="w-boton w-boton--primario si-anadir__boton" disabled={ocupado}>Añadir sitio</button>
          {errorCampo && <p id="si-error" className="w-campo__error si-anadir__error" role="alert">{errorCampo}</p>}
        </form>

        {vista.filas.length ? (
          <div className="si-tabla" role="table" aria-label="Sitios bloqueados">
            <div className="si-tabla__fila si-tabla__cabeza" role="row">
              <span role="columnheader">SITIO WEB</span>
              <span role="columnheader">HORARIO</span>
              <span role="columnheader">INTENTOS (7 DÍAS)</span>
              <span role="columnheader">ESTADO</span>
              <span role="columnheader"><span className="sr-solo">Quitar</span></span>
            </div>
            {vista.filas.map((s) => (
              <div key={s.numero} className={`si-tabla__fila${s.activo ? '' : ' si-tabla__fila--pausa'}`} role="row">
                <span role="cell" className="si-sitio">
                  <i aria-hidden="true">{s.dominio.charAt(0).toUpperCase()}</i>
                  <b>{s.dominio}</b>
                </span>
                <span role="cell">
                  {s.activo ? (
                    <select className="si-horario" value={s.horario} aria-label={`Horario de ${s.dominio}`} disabled={ocupado}
                      onChange={(e) => cambiarHorario(s, e.target.value)}>
                      {opciones.map((o) => <option key={o.id} value={o.id}>{o.texto}</option>)}
                    </select>
                  ) : (
                    <span className="w-texto--3">{s.pausaHasta ? 'En pausa hasta mañana' : 'En pausa'}</span>
                  )}
                </span>
                <span role="cell" className="si-num">{s.intentos}</span>
                <span role="cell">
                  <button type="button" className={`si-estado si-estado--${s.activo ? 'activo' : 'pausa'}`} disabled={ocupado}
                    title={s.activo ? 'Pausar hasta mañana' : 'Volver a bloquear'} onClick={() => pausar(s, s.activo)}>
                    {s.activo ? 'Activo' : 'Pausado'}
                  </button>
                </span>
                <span role="cell">
                  <button type="button" className="si-quitar" aria-label={`Quitar ${s.dominio}`} disabled={ocupado} onClick={() => setQuitando(s)}>
                    <img src={iconoPapelera} alt="" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="si-vacio">
            <EstadoVacio icono={iconoGlobo} titulo="Aún no bloqueas ningún sitio"
              detalle="Escribe un sitio arriba o elige una sugerencia. Cuando intentes abrirlo en tu teléfono verás una pausa en lugar de la página." />
          </div>
        )}

        {sugerencias.length > 0 && (
          <>
            <div className="w-divisor" />
            <p className="w-etiqueta">SUGERENCIAS PARA BLOQUEAR</p>
            <div className="si-sugerencias">
              {sugerencias.map((s) => (
                <button key={s} type="button" disabled={ocupado} onClick={() => anadir(s, 'siempre')}>
                  <Icono src={iconoMas} tam={14} />{s}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="w-divisor" />
        <p className="w-etiqueta">INTENTOS DE ESTA SEMANA</p>
        <div className="si-barras" role="img" aria-label={`Intentos por día: ${vista.dias.map((d) => `${d.etiqueta} ${d.intentos}`).join(', ')}`}>
          {vista.dias.map((d) => (
            <div key={d.fecha} className={d.hoy ? 'si-barras__hoy' : ''}>
              <b>{d.intentos}</b>
              <span><i style={{ height: `${(d.intentos / vista.maxDia) * 100}%` }} /></span>
              <small>{d.etiqueta}</small>
            </div>
          ))}
        </div>
      </section>

      <aside className="w-tarjeta si-lado">
        <h2 className="w-titulo-3">Más intentos esta semana</h2>
        {vista.top.length ? (
          <ul className="si-top">
            {vista.top.map((t) => (
              <li key={t.dominio}>
                <div><b>{t.dominio}</b><span>{plural(t.intentos, 'intento')}</span></div>
                <span className="si-top__barra"><i style={{ width: `${(t.intentos / masUsado.intentos) * 100}%` }} /></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="w-cuerpo w-texto--3">Esta semana no intentaste abrir ningún sitio bloqueado.</p>
        )}

        <p className="si-sync">
          <Icono src={iconoTelefono} tam={16} />
          {usuario.demo
            ? 'Demo: los cambios se quedan en este navegador'
            : `Tu teléfono se actualizó ${ultimaSync ? haceCuanto(new Date(ultimaSync).toISOString()).toLowerCase() : 'hace poco'}`}
        </p>

        <div className="w-divisor" />
        <p className="w-etiqueta">CÓMO FUNCIONA EL BLOQUEO</p>
        <div className="si-info">
          <Icono src={iconoInfo} tam={16} />
          <div>
            <b>Se aplica en el navegador</b>
            <span>Cuando intentas abrir un sitio bloqueado ves una pausa en lugar de la página.</span>
          </div>
        </div>

        <div className="w-divisor" />
        <p className="w-etiqueta">IDEAS PARA EMPEZAR</p>
        <ul className="si-ideas">
          <li>
            <span><Icono src={iconoLuna} tam={16} /></span>
            <div><b>Bloquea de noche</b><small>De 22:00 a 06:00 es cuando más te cuesta.</small></div>
          </li>
          <li>
            <span><Icono src={iconoMeta} tam={16} /></span>
            <div><b>Empieza con uno</b><small>El sitio que más usas es el mejor primer paso.</small></div>
          </li>
        </ul>
      </aside>

      {quitando && (
        <Dialogo icono={iconoPapeleraRoja} tono="peligro" ancho={460} titulo={`¿Quitar ${quitando.dominio} de la lista?`}
          detalle="Dejará de bloquearse en tu teléfono en unos segundos. Su historial de intentos se conserva para tus reportes."
          onCerrar={() => setQuitando(null)}
          acciones={(
            <>
              <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={() => setQuitando(null)}>Cancelar</button>
              <button type="button" className="w-dlg-boton w-dlg-boton--peligro" onClick={() => quitar(quitando)}>Quitar sitio</button>
            </>
          )} />
      )}
    </div>
  )
}
