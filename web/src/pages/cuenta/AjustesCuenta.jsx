// Ajustes de la cuenta (Figma e38 Cuenta, e39 Notificaciones, e40 Privacidad y datos, e41 Dispositivo)
import { useCallback, useEffect, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { iniciales } from '../../components/Menu.jsx'
import Dialogo from '../../components/web/Dialogo.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import { Banner, Esqueleto } from '../../components/web/Comunes.jsx'
import { csvDeDatos } from '../../data/ajustes.js'
import {
  ZONAS, actividadHoy, cargarCuenta, conHistorial, esteNavegador, fechaCorta, fechaLarga, guardarConfig, haceTexto,
  historialPermisos, permisos, telefonoVinculado,
} from '../../data/cuenta.js'
import { horas, limiteActual } from '../../data/plan.js'
import { fechaServidor } from '../../data/panel.js'
import { api } from '../../api.js'
import iconoUsuarios from '../../assets/icons/cu-usuarios.svg'
import iconoReloj from '../../assets/icons/cu-reloj.svg'
import iconoNube from '../../assets/icons/cu-nube.svg'
import iconoNubeGrande from '../../assets/icons/cu-nube-28.svg'
import iconoGlobo from '../../assets/icons/cu-globo.svg'
import iconoCalendario from '../../assets/icons/cu-calendario.svg'
import iconoInfoVerde from '../../assets/icons/cu-info-verde.svg'
import iconoInfoAzul from '../../assets/icons/cu-info-azul.svg'
import iconoInfoGrande from '../../assets/icons/cu-info-20.svg'
import iconoMetaMarca from '../../assets/icons/cu-meta-marca.svg'
import iconoRelojMarca from '../../assets/icons/cu-reloj-marca.svg'
import iconoLunaMarca from '../../assets/icons/cu-luna-marca.svg'
import iconoMeta from '../../assets/icons/cu-meta.svg'
import iconoLuna from '../../assets/icons/cu-luna.svg'
import iconoSi from '../../assets/icons/cu-si.svg'
import iconoNo from '../../assets/icons/cu-no.svg'
import iconoCheck from '../../assets/icons/cu-check.svg'
import iconoApps from '../../assets/icons/cu-apps.svg'
import iconoActividad from '../../assets/icons/cu-actividad.svg'
import iconoMensaje from '../../assets/icons/cu-mensaje.svg'
import iconoActualizar from '../../assets/icons/cu-actualizar.svg'
import iconoAlerta from '../../assets/icons/w-dlg-alerta.svg'
import './AjustesCuenta.css'

const PESTANAS = [
  { id: 'cuenta', titulo: 'Cuenta', desc: 'Tu cuenta, avisos, privacidad y teléfono vinculado.' },
  { id: 'avisos', titulo: 'Notificaciones', desc: 'Elige qué avisos recibir y cuándo no molestarte.' },
  { id: 'privacidad', titulo: 'Privacidad y datos', desc: 'Tú decides qué se comparte y con quién.' },
  { id: 'dispositivo', titulo: 'Dispositivo', desc: 'El teléfono donde Focus! aplica tus límites.' },
]

const AVISOS = [
  { id: 'limite', titulo: 'Cuando cambie mi límite', desc: 'El lunes, con el nuevo límite y por qué cambió.' },
  { id: 'cercaLimite', titulo: 'Cuando me acerque a mi límite', desc: 'Al llegar al 80 % de tu tiempo del día.' },
  { id: 'modoFoco', titulo: 'Recordatorio de Modo Foco', desc: 'Todos los días a las 23:30.' },
  { id: 'resumen', titulo: 'Resumen semanal de Foqui', desc: 'Los lunes a las 08:00.' },
  { id: 'riesgo', titulo: 'Riesgo alto', desc: 'Si tu riesgo de la próxima semana pasa de 60 %.' },
  { id: 'correo', titulo: 'Correo con el resumen', desc: 'Una copia del resumen semanal a tu correo.' },
]

const RECIBE = [
  { si: true, texto: 'Minutos totales de la semana' },
  { si: true, texto: 'Días que cumpliste y tu racha' },
  { si: true, texto: 'Cambio del plan y nivel de riesgo' },
  { si: false, texto: 'Nombres de apps' },
  { si: false, texto: 'Horarios y eventos individuales' },
]

const CONSERVACION = [
  { icono: iconoApps, titulo: 'Uso por app', tiempo: '12 meses' },
  { icono: iconoActividad, titulo: 'Riesgo y plan', tiempo: '12 meses' },
  { icono: iconoMensaje, titulo: 'Resúmenes de Foqui', tiempo: '6 meses' },
  { icono: iconoGlobo, titulo: 'Sitios bloqueados', tiempo: 'mientras los uses' },
]

const AYUDA_CONEXION = [
  'Abre la app Focus! en tu teléfono y confirma que entraste con esta cuenta.',
  'Revisa que el teléfono tenga internet (Wi-Fi o datos).',
  'En Ajustes del teléfono › Apps › Focus!, permite "Uso de apps", "Accesibilidad" y "Mostrar sobre otras apps".',
  'Vuelve aquí y pulsa "Actualizar ahora".',
]

const AYUDA_CAMBIO = [
  'Instala Focus! en el teléfono nuevo desde la tienda de apps.',
  'Entra con el mismo correo y contraseña de esta cuenta.',
  'Acepta los permisos que te pide la app.',
  'El teléfono anterior se desvincula solo y tu plan sigue igual.',
]

function Interruptor({ activo, etiqueta, onCambio, deshabilitado }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} className="w-interruptor"
      disabled={deshabilitado} onClick={() => onCambio(!activo)} />
  )
}

function Tarjeta({ titulo, desc, className = '', children }) {
  return (
    <section className={`w-tarjeta cu-tarjeta ${className}`}>
      {(titulo || desc) && (
        <div className="cu-tarjeta__titulos">
          {titulo && <h2 className="w-titulo-3">{titulo}</h2>}
          {desc && <p className="w-cuerpo w-texto--2">{desc}</p>}
        </div>
      )}
      {children}
    </section>
  )
}

// Fila gris con ícono en burbuja blanca, nombre y valor (Preferencias, Sesiones, Protecciones…)
function FilaGris({ icono, titulo, detalle, valor, tono, children }) {
  return (
    <div className="cu-gris">
      <span className="cu-gris__icono"><Icono src={icono} tam={16} /></span>
      <span className="cu-gris__texto">
        <b>{titulo}</b>
        {detalle && <small>{detalle}</small>}
      </span>
      {children ?? <b className={`cu-gris__valor${tono ? ` cu-gris__valor--${tono}` : ''}`}>{valor}</b>}
    </div>
  )
}

function FilaDato({ icono, titulo, valor }) {
  return (
    <div className="cu-dato">
      <Icono src={icono} tam={16} />
      <span>{titulo}</span>
      <b>{valor}</b>
    </div>
  )
}

function FilaInterruptor({ titulo, desc, activo, onCambio }) {
  return (
    <div className="cu-opcion">
      <span>
        <b>{titulo}</b>
        <small>{desc}</small>
      </span>
      <Interruptor activo={activo} etiqueta={titulo} onCambio={onCambio} />
    </div>
  )
}

function Nota({ icono, tono, titulo, children }) {
  return (
    <div className={`cu-nota cu-nota--${tono}`}>
      <Icono src={icono} tam={16} />
      <span>
        <b>{titulo}</b>
        <small>{children}</small>
      </span>
    </div>
  )
}

function Pasos({ pasos }) {
  return (
    <ol className="cu-pasos">
      {pasos.map((p, i) => <li key={p}><b>{i + 1}</b><span>{p}</span></li>)}
    </ol>
  )
}

// ---------- e38 · Cuenta ----------

function CambiarContrasena({ onCerrar, onGuardar }) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [estado, setEstado] = useState({ guardando: false, error: null })
  const corta = nueva.length > 0 && nueva.length < 6
  const distinta = repetir.length > 0 && repetir !== nueva
  const valida = nueva.length >= 6 && nueva.length <= 72 && nueva === repetir

  async function guardar(e) {
    e.preventDefault()
    if (!valida) return
    setEstado({ guardando: true, error: null })
    const error = await onGuardar(nueva)
    if (error) setEstado({ guardando: false, error })
  }

  return (
    <Dialogo icono={iconoAlerta} titulo="Cambiar contraseña" detalle="La usarás para entrar al portal y a la app del teléfono." ancho={480} onCerrar={onCerrar}
      acciones={(
        <>
          <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="cu-contrasena" className="w-dlg-boton w-dlg-boton--primario" disabled={!valida || estado.guardando}>
            {estado.guardando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </>
      )}>
      <form id="cu-contrasena" className="cu-formulario" onSubmit={guardar}>
        <label className={`w-campo${corta ? ' w-campo--error' : ''}`}>
          <span>Nueva contraseña</span>
          <input type="password" autoComplete="new-password" maxLength={72} value={nueva} onChange={(e) => setNueva(e.target.value)} />
          {corta && <small className="w-campo__error">Usa al menos 6 caracteres.</small>}
        </label>
        <label className={`w-campo${distinta ? ' w-campo--error' : ''}`}>
          <span>Repite la contraseña</span>
          <input type="password" autoComplete="new-password" maxLength={72} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          {distinta && <small className="w-campo__error">Las contraseñas no coinciden.</small>}
        </label>
        {estado.error && <p className="w-campo__error" role="alert">{estado.error}</p>}
      </form>
    </Dialogo>
  )
}

function TabCuenta({ usuario, perfil, cuenta, datos, onPerfil, onCuenta, onDialogo, avisar }) {
  const [nombre, setNombre] = useState(perfil.nombre)
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [dialogo, setDialogo] = useState(null)
  const archivo = useRef(null)
  const telefono = telefonoVinculado(datos)
  const nombreLimpio = nombre.trim()
  const nombreCambiado = nombreLimpio !== perfil.nombre

  async function guardarNombre() {
    if (!nombreLimpio || !nombreCambiado) return
    setGuardandoNombre(true)
    try {
      const nuevo = usuario.demo ? { ...perfil, nombre: nombreLimpio } : await api.actualizarPerfil(usuario.id, { nombre: nombreLimpio })
      onPerfil(nuevo)
      setNombre(nuevo.nombre)
      avisar({ tono: 'exito', titulo: 'Nombre actualizado', detalle: 'Foqui ya te llama así en tus resúmenes.' })
    } catch (err) {
      avisar({ tono: 'error', titulo: 'No se pudo guardar tu nombre', detalle: err.message || 'Sin conexión con la nube.' })
    } finally {
      setGuardandoNombre(false)
    }
  }

  async function subirFoto(e) {
    const elegido = e.target.files?.[0]
    e.target.value = ''
    if (!elegido) return
    if (usuario.demo) {
      avisar({ tono: 'info', titulo: 'En la demo no se guardan fotos', detalle: 'Entra con tu cuenta para cambiar tu foto.' })
      return
    }
    if (elegido.size > 5 * 1024 * 1024) {
      avisar({ tono: 'error', titulo: 'La imagen pesa más de 5 MB', detalle: 'Elige una foto más ligera (JPG, PNG o WEBP).' })
      return
    }
    setSubiendo(true)
    try {
      onPerfil(await api.subirFoto(usuario.id, elegido))
      avisar({ tono: 'exito', titulo: 'Foto actualizada' })
    } catch (err) {
      avisar({ tono: 'error', titulo: 'No se pudo subir la foto', detalle: err.message || 'Sin conexión con la nube.' })
    } finally {
      setSubiendo(false)
    }
  }

  async function guardarContrasena(password) {
    try {
      if (!usuario.demo) await api.actualizarPerfil(usuario.id, { password })
      await onCuenta({ ...cuenta, passwordCambiada: new Date().toISOString() })
      setDialogo(null)
      avisar({ tono: 'exito', titulo: 'Contraseña cambiada', detalle: usuario.demo ? 'En la demo no se cambia ninguna contraseña real.' : 'Úsala la próxima vez que entres.' })
      return null
    } catch (err) {
      return err.message || 'Sin conexión con la nube.'
    }
  }

  const registro = fechaServidor(perfil.fecha_registro)

  return (
    <div className="cu-columnas">
      <div className="cu-columna">
        <Tarjeta titulo="Perfil" desc="Así te ve Foqui en tus resúmenes.">
          <div className="cu-perfil">
            {perfil.foto_url ? (
              <img className="cu-avatar" src={perfil.foto_url} alt="" />
            ) : (
              <span className="cu-avatar">{iniciales(perfil.nombre)}</span>
            )}
            <span className="cu-perfil__texto">
              <b className="w-titulo-3">{perfil.nombre}</b>
              <span className="w-cuerpo w-texto--2">Estudiante · Universidad Autónoma de Querétaro</span>
            </span>
            <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={subirFoto} />
            <button type="button" className="w-boton w-boton--secundario" disabled={subiendo} onClick={() => archivo.current.click()}>
              {subiendo ? 'Subiendo…' : 'Cambiar foto'}
            </button>
          </div>
          <div className="cu-campos">
            <label className={`cu-campo${!nombreLimpio ? ' cu-campo--error' : ''}`}>
              <b>Nombre</b>
              <input value={nombre} maxLength={120} autoComplete="name" onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && guardarNombre()} />
              {!nombreLimpio && <small>Escribe cómo quieres que te llamemos.</small>}
            </label>
            <label className="cu-campo">
              <b>Correo</b>
              <input value={perfil.email} readOnly aria-describedby="cu-correo-ayuda" />
              <small id="cu-correo-ayuda">Aquí te llegan los avisos.</small>
            </label>
          </div>
          {nombreCambiado && (
            <div className="cu-guardar">
              <button type="button" className="w-boton w-boton--secundario" onClick={() => setNombre(perfil.nombre)}>Cancelar</button>
              <button type="button" className="w-boton w-boton--primario" disabled={!nombreLimpio || guardandoNombre} onClick={guardarNombre}>
                {guardandoNombre ? 'Guardando…' : 'Guardar nombre'}
              </button>
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <div className="cu-perfil">
            <span className="cu-perfil__texto">
              <b className="w-titulo-3">Contraseña</b>
              <span className="w-cuerpo w-texto--2">
                Último cambio: {cuenta.passwordCambiada ? haceTexto(cuenta.passwordCambiada) : `al registrarte (${haceTexto(registro)})`}
              </span>
            </span>
            <button type="button" className="w-boton w-boton--secundario" onClick={() => setDialogo('contrasena')}>Cambiar contraseña</button>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Preferencias" desc="Cómo ves fechas, horas y semanas en Focus!.">
          <div className="cu-preferencias">
            <FilaGris icono={iconoGlobo} titulo="Idioma" valor="Español (México)" />
            <FilaGris icono={iconoReloj} titulo="Zona horaria">
              <select className="cu-selector" aria-label="Zona horaria" value={cuenta.preferencias.zona}
                onChange={(e) => onCuenta({ ...cuenta, preferencias: { ...cuenta.preferencias, zona: e.target.value } })}>
                {ZONAS.map((z) => <option key={z.id} value={z.id}>{z.titulo}</option>)}
              </select>
            </FilaGris>
            <FilaGris icono={iconoCalendario} titulo="La semana empieza">
              <select className="cu-selector" aria-label="La semana empieza" value={cuenta.preferencias.semana}
                onChange={(e) => onCuenta({ ...cuenta, preferencias: { ...cuenta.preferencias, semana: e.target.value } })}>
                <option value="lunes">Lunes</option>
                <option value="domingo">Domingo</option>
              </select>
            </FilaGris>
            <FilaGris icono={iconoReloj} titulo="Formato de hora">
              <select className="cu-selector" aria-label="Formato de hora" value={cuenta.preferencias.hora}
                onChange={(e) => onCuenta({ ...cuenta, preferencias: { ...cuenta.preferencias, hora: e.target.value } })}>
                <option value="24">24 horas</option>
                <option value="12">12 horas</option>
              </select>
            </FilaGris>
          </div>
        </Tarjeta>
      </div>

      <div className="cu-columna cu-columna--lateral">
        <Tarjeta titulo="Tu cuenta">
          <FilaDato icono={iconoUsuarios} titulo="Tipo" valor={usuario.demo ? 'Demostración' : 'Estudiante'} />
          <FilaDato icono={iconoReloj} titulo="Miembro desde" valor={fechaLarga(registro)} />
          <FilaDato icono={iconoNube} titulo="Programa" valor="Piloto Focus! · UAQ" />
        </Tarjeta>

        <Tarjeta titulo="Zona de cuidado" desc="Estas acciones afectan tu cuenta.">
          <div className="cu-botones">
            <button type="button" className="w-boton w-boton--secundario" onClick={() => onDialogo('salir')}>Cerrar sesión</button>
            <button type="button" className="w-boton w-boton--peligro" onClick={() => onDialogo('desactivar')}>Desactivar cuenta</button>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Sesiones abiertas" desc="Dónde está abierta tu cuenta ahora.">
          <FilaGris icono={iconoGlobo} titulo="Este navegador" detalle={esteNavegador()} valor="Activa ahora" tono="exito" />
          {telefono?.token && (
            <FilaGris icono={iconoNube} titulo="Teléfono Android" detalle={`App Focus! · vinculado el ${fechaCorta(telefono.desde)}`}
              valor={telefono.ultimo ? haceTexto(telefono.ultimo) : 'sin datos'} />
          )}
        </Tarjeta>
      </div>

      {dialogo === 'contrasena' && <CambiarContrasena onCerrar={() => setDialogo(null)} onGuardar={guardarContrasena} />}
    </div>
  )
}

// ---------- e39 · Notificaciones ----------

function TabAvisos({ cuenta, datos, onCuenta }) {
  const cambiarAviso = (id, v) => onCuenta({ ...cuenta, avisos: { ...cuenta.avisos, [id]: v } })
  const cambiarSilencio = (cambio) => onCuenta({ ...cuenta, silencio: { ...cuenta.silencio, ...cambio } })
  const limite = datos?.plan ? limiteActual(datos.plan, datos.ajustes) : 133

  return (
    <div className="cu-columnas">
      <Tarjeta titulo="Avisos" desc="Llegan a tu teléfono y, si quieres, a tu correo." className="cu-tarjeta--alta">
        <div className="cu-opciones">
          {AVISOS.map((a) => (
            <FilaInterruptor key={a.id} titulo={a.titulo} desc={a.desc} activo={cuenta.avisos[a.id]} onCambio={(v) => cambiarAviso(a.id, v)} />
          ))}
        </div>
      </Tarjeta>

      <div className="cu-columna cu-columna--lateral">
        <Tarjeta titulo="Horario silencioso" desc="No te enviamos avisos en este horario.">
          <div className="cu-campos">
            <label className="cu-campo">
              <b>Desde</b>
              <input type="time" value={cuenta.silencio.desde} onChange={(e) => e.target.value && cambiarSilencio({ desde: e.target.value })} />
            </label>
            <label className="cu-campo">
              <b>Hasta</b>
              <input type="time" value={cuenta.silencio.hasta} onChange={(e) => e.target.value && cambiarSilencio({ hasta: e.target.value })} />
            </label>
          </div>
          <FilaInterruptor titulo="Fines de semana" desc="También sábado y domingo." activo={cuenta.silencio.finesDeSemana}
            onCambio={(v) => cambiarSilencio({ finesDeSemana: v })} />
        </Tarjeta>

        <Nota icono={iconoInfoVerde} tono="exito" titulo="Los avisos ayudan">
          Las personas que dejan activo el aviso del 80 % se pasan de su límite 2 veces menos.
        </Nota>

        <Tarjeta titulo="Así se ven en tu teléfono">
          <div className="cu-vistas">
            <div className="cu-vista">
              <span className="cu-vista__icono"><Icono src={iconoMetaMarca} tam={16} /></span>
              <span className="cu-vista__texto">
                <span><b>Focus! · Tu límite cambió</b><small>Lun 08:00</small></span>
                <small>Desde hoy tu límite es de {horas(limite)}. ¡Buen trabajo!</small>
              </span>
            </div>
            <div className="cu-vista">
              <span className="cu-vista__icono"><Icono src={iconoRelojMarca} tam={16} /></span>
              <span className="cu-vista__texto">
                <span><b>Focus! · Llevas el 80 % de tu tiempo</b><small>Jue 19:40</small></span>
                <small>Te quedan {horas(Math.round(limite * 0.2))} para hoy.</small>
              </span>
            </div>
            <div className="cu-vista">
              <span className="cu-vista__icono"><Icono src={iconoLunaMarca} tam={16} /></span>
              <span className="cu-vista__texto">
                <span><b>Focus! · ¿Activamos el Modo Foco?</b><small>Jue 23:30</small></span>
                <small>Son las 23:30. Deja el celular fuera del cuarto.</small>
              </span>
            </div>
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}

// ---------- e40 · Privacidad y datos ----------

function TabPrivacidad({ usuario, perfil, config, cuenta, datos, onGuardar, avisar }) {
  const [borrando, setBorrando] = useState(false)
  const participa = !config.consentimientoRetirado
  const historial = historialPermisos(cuenta, perfil)

  function cambiarParticipacion(v) {
    const texto = v ? 'Volviste a participar en el estudio' : 'Dejaste de participar en el estudio'
    onGuardar({ consentimientoRetirado: !v, cuenta: conHistorial(cuenta, texto) })
  }

  function cambiarFoqui(v) {
    const texto = v ? 'Aceptaste compartir tus respuestas de Foqui' : 'Dejaste de compartir tus respuestas de Foqui'
    onGuardar({ cuenta: { ...conHistorial(cuenta, texto), compartirFoqui: v } })
  }

  function descargarDatos() {
    if (!datos) return
    const url = URL.createObjectURL(new Blob([csvDeDatos(datos)], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: `focus-mis-datos_${usuario.demo ? 'demo' : usuario.id}.csv` }).click()
    URL.revokeObjectURL(url)
    avisar({ tono: 'exito', titulo: 'Datos descargados', detalle: `${datos.eventos.length} eventos, ${datos.pausas.length} pausas y ${datos.apps.length} apps del periodo cargado.` })
  }

  async function pedirBorrado() {
    const ahora = new Date()
    const ok = await onGuardar({ cuenta: { ...conHistorial(cuenta, 'Pediste borrar tus datos', ahora), solicitudBorrado: ahora.toISOString() } })
    setBorrando(false)
    if (ok) avisar({ tono: 'exito', titulo: 'Solicitud enviada', detalle: 'El equipo de la UAQ borrará tus datos en un máximo de 5 días hábiles.' })
  }

  return (
    <div className="cu-columnas">
      <div className="cu-columna">
        <Tarjeta titulo="Estudio de hábitos" desc="Focus! es parte de un estudio de la UAQ.">
          <div className="cu-opciones">
            <FilaInterruptor titulo="Participar en el estudio" desc="Usamos tus datos sin tu nombre para entender hábitos de uso."
              activo={participa} onCambio={cambiarParticipacion} />
            <FilaInterruptor titulo="Compartir mis respuestas de Foqui" desc="Ayuda a mejorar cómo Foqui explica tu semana."
              activo={cuenta.compartirFoqui} onCambio={cambiarFoqui} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Lo que recibe Foqui" desc="Foqui solo pone en palabras estos números.">
          <ul className="cu-recibe">
            {RECIBE.map((r) => (
              <li key={r.texto}>
                <span className={`cu-recibe__marca cu-recibe__marca--${r.si ? 'si' : 'no'}`}><Icono src={r.si ? iconoSi : iconoNo} tam={12} /></span>
                {r.si ? 'Sí recibe' : 'Nunca recibe'}: {r.texto}
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Historial de permisos" desc="Cada cambio queda registrado.">
          <div className="cu-lista">
            {historial.map((h) => (
              <FilaGris key={`${h.fecha}-${h.texto}`} icono={iconoCheck} titulo={h.texto} valor={fechaCorta(h.fecha)} tono="suave" />
            ))}
          </div>
        </Tarjeta>
      </div>

      <div className="cu-columna cu-columna--lateral">
        <Tarjeta titulo="Tus datos" desc="Puedes llevártelos o borrarlos cuando quieras.">
          <div className="cu-botones">
            <button type="button" className="w-boton w-boton--secundario" disabled={!datos} onClick={descargarDatos}>Descargar mis datos</button>
            <button type="button" className="w-boton w-boton--peligro" disabled={Boolean(cuenta.solicitudBorrado)} onClick={() => setBorrando(true)}>
              {cuenta.solicitudBorrado ? `Borrado pedido el ${fechaCorta(cuenta.solicitudBorrado)}` : 'Borrar mis datos'}
            </button>
          </div>
        </Tarjeta>

        <Nota icono={iconoInfoAzul} tono="info" titulo="Guardados con cuidado">
          Tus datos se guardan protegidos en la UAQ y solo se usan para el estudio. Procesamos las solicitudes en un máximo de 5 días hábiles.
        </Nota>

        <Tarjeta titulo="Qué guardamos y por cuánto tiempo">
          <div className="cu-lista">
            {CONSERVACION.map((c) => <FilaGris key={c.titulo} icono={c.icono} titulo={c.titulo} valor={c.tiempo} tono="suave" />)}
          </div>
        </Tarjeta>
      </div>

      {borrando && (
        <Dialogo icono={iconoAlerta} tono="peligro" titulo="¿Borrar tus datos?" ancho={500} onCerrar={() => setBorrando(false)}
          detalle="El equipo de la UAQ borrará tu uso, tus pausas, tu plan y tus resúmenes en un máximo de 5 días hábiles. No se puede deshacer."
          nota="Tu cuenta sigue activa."
          acciones={(
            <>
              <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={() => setBorrando(false)}>Cancelar</button>
              <button type="button" className="w-dlg-boton w-dlg-boton--peligro" onClick={pedirBorrado}>Pedir el borrado</button>
            </>
          )} />
      )}
    </div>
  )
}

// ---------- e41 · Dispositivo ----------

function Actividad({ datos }) {
  const porHora = actividadHoy(datos)
  const max = Math.max(1, ...porHora)
  return (
    <div className="cu-actividad" role="img" aria-label={`Eventos enviados hoy por hora: ${porHora.reduce((s, n) => s + n, 0)} en total`}>
      {porHora.map((n, h) => (
        <div key={h}>
          <i className={n ? '' : 'cu-actividad__vacia'} style={{ height: n ? `${Math.max(7, (n / max) * 46)}px` : undefined }} />
          <small>{h % 6 === 0 ? String(h).padStart(2, '0') : ' '}</small>
        </div>
      ))}
    </div>
  )
}

function TabDispositivo({ usuario, config, datos, onRecargar, avisar }) {
  const [dialogo, setDialogo] = useState(null)
  const [desvinculando, setDesvinculando] = useState(false)
  const telefono = telefonoVinculado(datos)
  const token = telefono?.token
  const sitios = datos?.estadisticas?.dominios_bloqueados_activos ?? 0
  const appsConPausa = (datos?.apps ?? []).filter((a) => !(config.appsInactivas ?? []).includes(a.numero)).length
  const modoFoco = config.modoFoco ?? { activo: true, inicio: '08:00' }

  async function actualizar() {
    await onRecargar()
    avisar({ tono: 'info', titulo: 'Datos actualizados', detalle: telefono?.ultimo ? `Último envío del teléfono: ${haceTexto(telefono.ultimo)}.` : 'Tu teléfono aún no ha enviado uso.' })
  }

  async function desvincular() {
    if (usuario.demo) {
      setDialogo(null)
      avisar({ tono: 'info', titulo: 'En la demo no se desvincula ningún teléfono' })
      return
    }
    setDesvinculando(true)
    try {
      await api.actualizarToken(usuario.id, token.numero, { activo: false })
      setDialogo(null)
      avisar({ tono: 'exito', titulo: 'Teléfono desvinculado', detalle: 'Focus! dejará de aplicar tus límites en ese teléfono.' })
      onRecargar()
    } catch (err) {
      avisar({ tono: 'error', titulo: 'No se pudo desvincular', detalle: err.message || 'Sin conexión con la nube.' })
    } finally {
      setDesvinculando(false)
    }
  }

  return (
    <div className="cu-columnas">
      <div className="cu-columna">
        <Tarjeta>
          <div className="cu-telefono">
            <span className="cu-telefono__icono"><Icono src={iconoNubeGrande} tam={28} /></span>
            <span className="cu-telefono__texto">
              <b className="w-titulo-2">{token ? 'Teléfono Android' : 'Sin teléfono vinculado'}</b>
              <span className="w-cuerpo w-texto--2">
                {token ? `App Focus! · vinculado el ${fechaLarga(telefono.desde)}` : 'Instala Focus! en tu teléfono y entra con esta cuenta.'}
              </span>
            </span>
            {token && (
              <span className={`cu-estado${telefono.conectado ? '' : ' cu-estado--apagado'}`}>
                <i aria-hidden="true" />{telefono.conectado ? 'Conectado' : 'Sin conexión reciente'}
              </span>
            )}
          </div>
          <div className="w-divisor" />
          <FilaDato icono={iconoActualizar} titulo="Última actualización" valor={telefono?.ultimo ? haceTexto(telefono.ultimo) : 'sin datos'} />
          <FilaDato icono={iconoReloj} titulo="Vinculado desde" valor={token ? fechaLarga(telefono.desde) : '—'} />
          <div className="cu-botones cu-botones--fila">
            <button type="button" className="w-boton w-boton--secundario" onClick={actualizar}>Actualizar ahora</button>
            {token && <button type="button" className="w-boton w-boton--peligro" onClick={() => setDialogo('desvincular')}>Desvincular</button>}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Permisos del teléfono" desc="Focus! los necesita para medir tu uso y mostrar las pausas.">
          <ul className="cu-permisos">
            {permisos(datos).map((p) => (
              <li key={p.id}>
                <span className={`cu-recibe__marca cu-recibe__marca--${p.ok ? 'si' : 'no'}`}><Icono src={p.ok ? iconoSi : iconoNo} tam={12} /></span>
                <span><b>{p.titulo}</b><small>{p.desc}</small></span>
                <b className={p.ok ? 'cu-ok' : 'cu-falta'}>{p.ok ? 'Concedido' : 'Sin datos aún'}</b>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <section className="w-tarjeta cu-ayuda">
          <span className="cu-ayuda__icono"><Icono src={iconoInfoGrande} tam={20} /></span>
          <span className="cu-perfil__texto">
            <b className="w-titulo-3">¿Tu teléfono no aparece conectado?</b>
            <span className="w-cuerpo w-texto--2">Abre la app Focus! y revisa que tenga internet y los permisos de arriba.</span>
          </span>
          <button type="button" className="w-boton w-boton--secundario" onClick={() => setDialogo('conexion')}>Ver ayuda</button>
        </section>
      </div>

      <div className="cu-columna cu-columna--lateral">
        <Tarjeta titulo="¿Cambiaste de teléfono?" desc="Instala Focus! en el nuevo y entra con esta cuenta. El anterior se desvincula solo.">
          <button type="button" className="w-boton w-boton--secundario" onClick={() => setDialogo('cambio')}>Ver cómo hacerlo</button>
        </Tarjeta>

        <Tarjeta titulo="Protecciones activas" desc="Lo que Focus! está cuidando en tu teléfono.">
          <div className="cu-lista">
            <FilaGris icono={iconoGlobo} titulo="Bloqueo de sitios" valor={`${sitios} ${sitios === 1 ? 'activo' : 'activos'}`} tono={sitios ? 'exito' : 'suave'} />
            <FilaGris icono={iconoMeta} titulo="Pausas antes de abrir apps" valor={`${appsConPausa} ${appsConPausa === 1 ? 'app' : 'apps'}`} tono={appsConPausa ? 'exito' : 'suave'} />
            <FilaGris icono={iconoLuna} titulo="Modo Foco programado" valor={modoFoco.activo ? modoFoco.inicio : 'Apagado'} tono={modoFoco.activo ? 'exito' : 'suave'} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Actividad de hoy" desc="Cuándo tu teléfono envió tu uso.">
          <Actividad datos={datos} />
        </Tarjeta>
      </div>

      {dialogo === 'desvincular' && (
        <Dialogo icono={iconoAlerta} tono="peligro" titulo="¿Desvincular este teléfono?" ancho={500} onCerrar={() => setDialogo(null)}
          detalle="Focus! dejará de medir tu uso y de mostrar pausas en ese teléfono. Puedes volver a vincularlo entrando de nuevo en la app."
          acciones={(
            <>
              <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={() => setDialogo(null)}>Cancelar</button>
              <button type="button" className="w-dlg-boton w-dlg-boton--peligro" disabled={desvinculando} onClick={desvincular}>
                {desvinculando ? 'Desvinculando…' : 'Desvincular'}
              </button>
            </>
          )} />
      )}
      {(dialogo === 'conexion' || dialogo === 'cambio') && (
        <Dialogo icono={iconoAlerta} ancho={520} onCerrar={() => setDialogo(null)}
          titulo={dialogo === 'conexion' ? 'Conecta tu teléfono' : 'Cambiar de teléfono'}
          detalle={dialogo === 'conexion' ? 'Sigue estos pasos en tu teléfono.' : 'Tu plan, tus límites y tu historial se quedan en tu cuenta.'}
          acciones={<button type="button" className="w-dlg-boton w-dlg-boton--primario" onClick={() => setDialogo(null)}>Entendido</button>}>
          <Pasos pasos={dialogo === 'conexion' ? AYUDA_CONEXION : AYUDA_CAMBIO} />
        </Dialogo>
      )}
    </div>
  )
}

// ---------- Página ----------

export default function AjustesCuenta({ usuario, datos, onRecargar, onPerfil, onDialogo, onExpirada }) {
  const avisar = useAvisos()
  const [pestana, setPestana] = useState('cuenta')
  const [estado, setEstado] = useState({ cargando: true, error: null, perfil: null, config: {}, cuenta: null })

  const cargar = useCallback(async () => {
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    try {
      const r = await cargarCuenta(usuario)
      setEstado({ cargando: false, error: null, ...r })
    } catch (err) {
      if (err.status === 401) return onExpirada()
      setEstado((e) => ({ ...e, cargando: false, error: err.message || 'Sin conexión con la nube' }))
    }
  }, [usuario, onExpirada])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Cambia la configuración en pantalla al momento y la guarda; si falla, regresa a la anterior
  async function guardar(cambios) {
    const previo = { config: estado.config, cuenta: estado.cuenta }
    const config = { ...estado.config, ...cambios }
    setEstado((e) => ({ ...e, config, cuenta: cambios.cuenta ?? e.cuenta }))
    try {
      await guardarConfig(usuario, cambios)
      return true
    } catch (err) {
      setEstado((e) => ({ ...e, ...previo }))
      avisar({ tono: 'error', titulo: 'No se guardó el cambio', detalle: err.message || 'Sin conexión con la nube.', accion: { texto: 'Reintentar', alPulsar: () => guardar(cambios) } })
      return false
    }
  }
  const guardarCuenta = (cuenta) => guardar({ cuenta })

  function cambiarPerfil(perfil) {
    setEstado((e) => ({ ...e, perfil }))
    if (perfil.nombre !== usuario.nombre) onPerfil({ ...usuario, nombre: perfil.nombre })
  }

  const actual = PESTANAS.find((p) => p.id === pestana)
  const { perfil, config, cuenta } = estado
  const comun = { usuario, perfil, config, cuenta, datos, avisar }

  let cuerpo
  if (estado.error && !perfil) {
    cuerpo = (
      <Banner tono="error" titulo="No se pudieron cargar tus ajustes" detalle={estado.error}
        accion={<button type="button" className="w-boton w-boton--secundario" onClick={cargar}>Reintentar</button>} />
    )
  } else if (!perfil) {
    cuerpo = (
      <div className="cu-columnas" aria-busy="true">
        <div className="cu-columna"><div className="w-tarjeta cu-tarjeta"><Esqueleto ancho={140} alto={18} /><Esqueleto alto={64} /><Esqueleto alto={44} /></div></div>
        <div className="cu-columna cu-columna--lateral"><div className="w-tarjeta cu-tarjeta"><Esqueleto ancho={120} alto={18} /><Esqueleto alto={80} /></div></div>
      </div>
    )
  } else if (pestana === 'cuenta') {
    cuerpo = <TabCuenta {...comun} onPerfil={cambiarPerfil} onCuenta={guardarCuenta} onDialogo={onDialogo} />
  } else if (pestana === 'avisos') {
    cuerpo = <TabAvisos {...comun} onCuenta={guardarCuenta} />
  } else if (pestana === 'privacidad') {
    cuerpo = <TabPrivacidad {...comun} onGuardar={guardar} />
  } else {
    cuerpo = <TabDispositivo {...comun} onRecargar={onRecargar} />
  }

  return (
    <div className="w-pagina cu">
      <header className="w-encabezado__titulos">
        <p className="w-sobretitulo">AJUSTES</p>
        <h1 className="w-display">Ajustes</h1>
        <p className="w-cuerpo w-texto--2">{actual.desc}</p>
      </header>
      <nav className="cu-pestanas" role="tablist" aria-label="Secciones de ajustes">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === pestana}
            className={`cu-pestana${p.id === pestana ? ' cu-pestana--activa' : ''}`} onClick={() => setPestana(p.id)}>
            {p.titulo}
          </button>
        ))}
      </nav>
      {cuerpo}
    </div>
  )
}
