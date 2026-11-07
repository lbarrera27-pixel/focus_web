// Cuenta (Figma e42 menú de usuario, e43 Mi perfil, e44 desactivar, e45 cerrar sesión, e46 sesión expirada, e47 404)
import { useEffect, useRef, useState } from 'react'
import Icono from '../../components/Icono.jsx'
import { iniciales } from '../../components/Menu.jsx'
import Dialogo from '../../components/web/Dialogo.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import { EstadoVacio } from '../../components/web/Comunes.jsx'
import { fechaServidor } from '../../data/panel.js'
import { telefonoVinculado } from '../../data/cuenta.js'
import { api } from '../../api.js'
import iconoPerfil from '../../assets/icons/cu-menu-perfil.svg'
import iconoAjustes from '../../assets/icons/cu-menu-ajustes.svg'
import iconoExportar from '../../assets/icons/cu-menu-exportar.svg'
import iconoAyuda from '../../assets/icons/cu-menu-ayuda.svg'
import iconoSalir from '../../assets/icons/cu-menu-salir.svg'
import fondoAvatar from '../../assets/icons/cu-avatar-fondo.svg'
import iconoCamara from '../../assets/icons/cu-camara.svg'
import iconoCorreo from '../../assets/icons/cu-correo.svg'
import iconoUsuarioX from '../../assets/icons/cu-usuario-x.svg'
import iconoNo from '../../assets/icons/cu-x-rojo.svg'
import iconoSi from '../../assets/icons/cu-check-verde.svg'
import iconoSalirGrande from '../../assets/icons/cu-salir-24.svg'
import iconoReloj from '../../assets/icons/cu-reloj-24.svg'
import iconoBuscar from '../../assets/icons/cu-buscar-24.svg'
import iconoAlerta from '../../assets/icons/w-dlg-alerta.svg'
import './DialogosCuenta.css'

const MAX_FOTO = 5 * 1024 * 1024
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const PALABRA = 'DESACTIVAR'

// ---------- e42 · Menú de usuario ----------

// Nivel de progreso según las semanas del plan que ya se cerraron
function nivelProgreso(semanas) {
  if (semanas >= 6) return 'Avanzado'
  if (semanas >= 3) return 'Intermedio'
  return 'Principiante'
}

export function MenuUsuario({ usuario, perfil, semanas = 0, onCerrar, onElegir }) {
  const caja = useRef(null)

  useEffect(() => {
    caja.current?.querySelector('button')?.focus()
    const alTeclear = (e) => e.key === 'Escape' && onCerrar()
    // El clic que abrió el menú no lo cierra: se escucha a partir del siguiente
    const alPulsar = (e) => !caja.current?.contains(e.target) && !e.target.closest?.('.menu__usuario') && onCerrar()
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('mousedown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('mousedown', alPulsar)
    }
  }, [onCerrar])

  const opcion = (id, icono, texto, clase = '') => (
    <button type="button" role="menuitem" className={`dc-menu__opcion ${clase}`} onClick={() => onElegir(id)}>
      <Icono src={icono} tam={18} />
      <span>{texto}</span>
    </button>
  )

  return (
    <div ref={caja} className="dc-menu" role="menu" aria-label="Menú de tu cuenta">
      <div className="dc-menu__cuenta">
        {perfil?.foto_url ? <img className="dc-menu__avatar" src={perfil.foto_url} alt="" /> : <span className="dc-menu__avatar">{iniciales(usuario.nombre)}</span>}
        <span className="dc-menu__texto">
          <b>{usuario.nombre}</b>
          <small>{usuario.demo ? 'demo@focus.app' : perfil?.email ?? ' '}</small>
          <i className="dc-nivel">{usuario.demo ? 'Modo demostración' : `Nivel: ${nivelProgreso(semanas)}`}</i>
        </span>
      </div>
      <hr />
      {opcion('perfil', iconoPerfil, 'Mi perfil')}
      {opcion('ajustes', iconoAjustes, 'Ajustes y reglas')}
      {opcion('exportar', iconoExportar, 'Exportar mis datos')}
      {opcion('ayuda', iconoAyuda, 'Ayuda y soporte')}
      <hr />
      {opcion('salir', iconoSalir, 'Cerrar sesión', 'dc-menu__opcion--salir')}
    </div>
  )
}

// ---------- e43 · Mi perfil ----------

export function MiPerfil({ usuario, datos, onCerrar, onPerfil, avisar }) {
  const [perfil, setPerfil] = useState(null)
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [foto, setFoto] = useState(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [estado, setEstado] = useState({ guardando: false, error: null })
  const archivo = useRef(null)

  useEffect(() => {
    let vivo = true
    const cargar = usuario.demo
      ? Promise.resolve({ nombre: usuario.nombre, email: 'demo@focus.app', foto_url: null, fecha_registro: new Date(Date.now() - 30 * 86_400_000).toISOString() })
      : api.usuario(usuario.id)
    cargar.then((p) => {
      if (!vivo) return
      // La API guarda un solo nombre: la primera palabra es el nombre y el resto los apellidos
      const [primero, ...resto] = p.nombre.trim().split(/\s+/)
      setPerfil(p)
      setNombre(primero ?? '')
      setApellidos(resto.join(' '))
    }).catch((err) => vivo && setEstado({ guardando: false, error: err.message || 'Sin conexión con la nube.' }))
    return () => {
      vivo = false
    }
  }, [usuario])

  useEffect(() => () => foto && URL.revokeObjectURL(foto.url), [foto])

  function elegir(f) {
    if (!f) return
    if (!TIPOS_FOTO.includes(f.type)) return setEstado({ guardando: false, error: 'Usa una foto JPG, PNG o WEBP.' })
    if (f.size > MAX_FOTO) return setEstado({ guardando: false, error: 'La foto pesa más de 5 MB.' })
    setEstado({ guardando: false, error: null })
    setFoto({ archivo: f, url: URL.createObjectURL(f) })
  }

  const completo = [nombre.trim(), apellidos.trim()].filter(Boolean).join(' ')
  const cambioNombre = perfil && completo !== perfil.nombre
  const puedeGuardar = perfil && nombre.trim() && (cambioNombre || foto) && !estado.guardando

  async function guardar(e) {
    e.preventDefault()
    if (!puedeGuardar) return
    setEstado({ guardando: true, error: null })
    try {
      let nuevo = perfil
      if (usuario.demo) {
        nuevo = { ...perfil, nombre: completo }
      } else {
        if (cambioNombre) nuevo = await api.actualizarPerfil(usuario.id, { nombre: completo })
        if (foto) nuevo = await api.subirFoto(usuario.id, foto.archivo)
      }
      onPerfil(nuevo)
      avisar({
        tono: 'exito', titulo: 'Perfil actualizado',
        detalle: usuario.demo && foto ? 'En la demo la foto no se guarda.' : 'Así te verá el equipo de investigación.',
      })
      onCerrar()
    } catch (err) {
      setEstado({ guardando: false, error: err.message || 'Sin conexión con la nube.' })
    }
  }

  const telefono = telefonoVinculado(datos)
  const vistaFoto = foto?.url ?? perfil?.foto_url

  return (
    <Dialogo titulo="Mi perfil" detalle="Así te ve el equipo de investigación en el portal." ancho={560} onCerrar={onCerrar} className="dc-perfil"
      nota={usuario.demo ? 'En la demo los cambios no salen de tu navegador.' : 'Se guarda en tu cuenta.'}
      acciones={(
        <>
          <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="dc-perfil" className="w-dlg-boton w-dlg-boton--primario" disabled={!puedeGuardar}>
            {estado.guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      )}>
      <form id="dc-perfil" className="dc-perfil__formulario" onSubmit={guardar}>
        <div
          className={`dc-foto${arrastrando ? ' dc-foto--encima' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files?.[0]) }}
        >
          <span className="dc-foto__avatar">
            {vistaFoto ? <img className="dc-foto__imagen" src={vistaFoto} alt="" /> : (
              <>
                <img src={fondoAvatar} alt="" width={76} height={76} />
                <b>{iniciales(completo || usuario.nombre)}</b>
              </>
            )}
            <i><img src={iconoCamara} alt="" width={14} height={14} /></i>
          </span>
          <span className="dc-foto__texto">
            <b>{foto ? foto.archivo.name : 'Arrastra una foto o elige un archivo'}</b>
            <small>Foto JPG, PNG o WEBP de hasta 5 MB</small>
            <span className="dc-foto__botones">
              <input ref={archivo} type="file" accept={TIPOS_FOTO.join(',')} hidden onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" className="dc-foto__subir" onClick={() => archivo.current.click()}>Subir foto</button>
              {foto && <button type="button" className="dc-foto__quitar" onClick={() => setFoto(null)}>Quitar</button>}
            </span>
          </span>
        </div>

        <div className="dc-fila">
          <label className="dc-campo">
            <span>Nombre</span>
            <input value={nombre} maxLength={60} autoComplete="given-name" disabled={!perfil} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label className="dc-campo">
            <span>Apellidos</span>
            <input value={apellidos} maxLength={60} autoComplete="family-name" disabled={!perfil} onChange={(e) => setApellidos(e.target.value)} />
          </label>
        </div>

        <div className="dc-campo">
          <span>Correo electrónico</span>
          <div className="dc-campo__fijo">
            <Icono src={iconoCorreo} tam={18} />
            <span>{perfil?.email ?? '…'}</span>
            <small>No editable</small>
          </div>
          <small>Para cambiar el correo escribe al equipo de investigación.</small>
        </div>

        <div className="dc-datos">
          <span><small>Miembro desde</small><b>{perfil ? fechaServidor(perfil.fecha_registro).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '…'}</b></span>
          <span><small>Plan activo</small><b>{datos?.plan ? `Semana ${datos.plan.semana_actual}` : 'Sin plan'}</b></span>
          <span><small>Dispositivo</small><b>{telefono?.token ? telefono.nombre : 'Sin vincular'}</b></span>
        </div>
        {estado.error && <p className="w-campo__error" role="alert">{estado.error}</p>}
      </form>
    </Dialogo>
  )
}

// ---------- e44 · Desactivar cuenta ----------

export function DesactivarCuenta({ usuario, onCerrar, onDesactivada, avisar }) {
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState({ enviando: false, error: null })
  const confirmado = texto.trim().toUpperCase() === PALABRA

  async function desactivar(e) {
    e.preventDefault()
    if (!confirmado) return
    if (usuario.demo) {
      avisar({ tono: 'info', titulo: 'En la demo no hay cuenta que desactivar' })
      return onCerrar()
    }
    setEstado({ enviando: true, error: null })
    try {
      await api.eliminarCuenta(usuario.id)
      onDesactivada()
    } catch (err) {
      setEstado({ enviando: false, error: err.message || 'Sin conexión con la nube.' })
    }
  }

  return (
    <Dialogo icono={iconoUsuarioX} tono="peligro" titulo="¿Desactivar tu cuenta?" ancho={500} onCerrar={onCerrar} className="dc-desactivar"
      detalle="Se cerrará la sesión y la cuenta quedará inactiva. Podrás reactivarla escribiendo al equipo de investigación."
      acciones={(
        <>
          <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="dc-desactivar" className="w-dlg-boton w-dlg-boton--peligro" disabled={!confirmado || estado.enviando}>
            {estado.enviando ? 'Desactivando…' : 'Desactivar y cerrar sesión'}
          </button>
        </>
      )}>
      <ul className="dc-consecuencias">
        <li><img src={iconoNo} alt="" width={16} height={16} />Tu teléfono dejará de enviar tu uso</li>
        <li><img src={iconoNo} alt="" width={16} height={16} />Se pierde el acceso al portal y a la mascota</li>
        <li><img src={iconoSi} alt="" width={16} height={16} />Tus registros se conservan de forma anónima para el estudio</li>
      </ul>
      <form id="dc-desactivar" onSubmit={desactivar}>
        <label className="dc-campo dc-campo--peligro">
          <span>Escribe {PALABRA} para confirmar</span>
          <input value={texto} autoComplete="off" spellCheck={false} onChange={(e) => setTexto(e.target.value)} />
        </label>
        {estado.error && <p className="w-campo__error" role="alert">{estado.error}</p>}
      </form>
    </Dialogo>
  )
}

// ---------- e45 · Cerrar sesión ----------

export function CerrarSesion({ onCerrar, onConfirmar }) {
  return (
    <Dialogo apilado icono={iconoSalirGrande} tono="peligro" titulo="¿Cerrar sesión?" ancho={460} onCerrar={onCerrar}
      detalle="Tu teléfono seguirá aplicando tus límites aunque cierres sesión aquí."
      acciones={(
        <>
          <button type="button" className="w-boton w-boton--secundario" onClick={onCerrar}>Cancelar</button>
          <button type="button" className="w-boton w-boton--peligro" onClick={onConfirmar}>Cerrar sesión</button>
        </>
      )} />
  )
}

// ---------- e46 · Sesión expirada ----------

export function SesionTerminada({ onEntrar }) {
  // No se puede descartar: la única salida es volver a entrar
  return (
    <Dialogo apilado icono={iconoReloj} tono="suave" titulo="Tu sesión terminó" ancho={460} onCerrar={() => {}}
      detalle="Por seguridad cerramos tu sesión después de un rato sin actividad. Todo lo que hiciste está guardado."
      acciones={<button type="button" className="w-boton w-boton--primario" onClick={onEntrar}>Volver a entrar</button>} />
  )
}

// ---------- Ayuda y soporte (opción del menú) ----------

export function Ayuda({ onCerrar, onNavegar }) {
  const ir = (id) => {
    onCerrar()
    onNavegar(id)
  }
  return (
    <Dialogo icono={iconoAlerta} titulo="Ayuda y soporte" ancho={520} onCerrar={onCerrar}
      detalle="Lo más consultado. Si algo no funciona, escribe al equipo de investigación de la Facultad de Informática (UAQ)."
      acciones={<button type="button" className="w-dlg-boton w-dlg-boton--primario" onClick={onCerrar}>Entendido</button>}>
      <ul className="dc-ayuda">
        <li><button type="button" onClick={() => ir('ajustes')}><b>Mi teléfono no aparece conectado</b><small>Ajustes › Dispositivo</small></button></li>
        <li><button type="button" onClick={() => ir('plan')}><b>¿Cómo cambia mi límite cada semana?</b><small>Mi plan</small></button></li>
        <li><button type="button" onClick={() => ir('apps')}><b>Quiero agregar o quitar apps y sitios</b><small>Apps y sitios</small></button></li>
        <li><button type="button" onClick={() => ir('foqui')}><b>Tengo dudas sobre mi semana</b><small>Pregúntale a Foqui</small></button></li>
      </ul>
    </Dialogo>
  )
}

// Diálogos de la cuenta abiertos desde el menú o desde Ajustes (vive dentro de ProveedorAvisos)
export function CapaCuenta({ dialogo, onDialogo, usuario, datos, onPerfil, onSalir, onNavegar }) {
  const avisar = useAvisos()
  const cerrar = () => onDialogo(null)
  if (dialogo === 'perfil') return <MiPerfil usuario={usuario} datos={datos} onCerrar={cerrar} onPerfil={onPerfil} avisar={avisar} />
  if (dialogo === 'desactivar') return <DesactivarCuenta usuario={usuario} onCerrar={cerrar} onDesactivada={onSalir} avisar={avisar} />
  if (dialogo === 'salir') return <CerrarSesion onCerrar={cerrar} onConfirmar={onSalir} />
  if (dialogo === 'expirada') return <SesionTerminada onEntrar={onSalir} />
  if (dialogo === 'ayuda') return <Ayuda onCerrar={cerrar} onNavegar={onNavegar} />
  return null
}

// ---------- e47 · Página no encontrada ----------

export function PaginaNoEncontrada({ onNavegar }) {
  return (
    <div className="w-pagina dc-404">
      <EstadoVacio icono={iconoBuscar} titulo="No encontramos esta página"
        detalle="Puede que el enlace esté mal escrito o que la página ya no exista."
        accion="Ir a Uso por app" onAccion={() => onNavegar('uso')} />
    </div>
  )
}
