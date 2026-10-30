// Acceso (Figma e1 inicio de sesión, e2 credenciales incorrectas, e3 entrando, e4 recupera tu contraseña,
// e5 revisa tu correo). El panel de marca de la izquierda es el mismo en las cinco pantallas.
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api.js'
import logo from '../../assets/acceso/logo.svg'
import brilloAmbar from '../../assets/acceso/brillo-ambar.svg'
import brilloAzul from '../../assets/acceso/brillo-azul.svg'
import puntoVerde from '../../assets/acceso/punto-verde.svg'
import iconoNube from '../../assets/acceso/icono-nube.svg'
import iconoIa from '../../assets/acceso/icono-ia.svg'
import iconoHabitos from '../../assets/acceso/icono-habitos.svg'
import mascota from '../../assets/acceso/mascota.png'
import iconoCorreo from '../../assets/acceso/correo.svg'
import iconoCandado from '../../assets/acceso/candado.svg'
import iconoMostrar from '../../assets/acceso/mostrar.svg'
import iconoCheck from '../../assets/acceso/check.svg'
import iconoFlecha from '../../assets/acceso/flecha.svg'
import logoGoogle from '../../assets/acceso/google.svg'
import logoApple from '../../assets/acceso/apple.svg'
import logoFacebook from '../../assets/acceso/facebook.svg'
import iconoDemo from '../../assets/acceso/demo.svg'
import iconoEscudo from '../../assets/acceso/escudo.svg'
import iconoAviso from '../../assets/acceso/aviso.svg'
import iconoAlerta from '../../assets/acceso/alerta.svg'
import iconoSpinner from '../../assets/acceso/spinner.svg'
import iconoVolver from '../../assets/acceso/volver.svg'
import iconoCandadoGrande from '../../assets/acceso/candado-grande.svg'
import iconoCorreoGrande from '../../assets/acceso/correo-grande.svg'
import iconoInfo from '../../assets/acceso/info.svg'
import './Acceso.css'

const CARACTERISTICAS = [
  { icono: iconoNube, titulo: 'Tu uso al momento', detalle: 'Lo que pasa en tu teléfono, al día' },
  { icono: iconoIa, titulo: 'Explicaciones claras', detalle: 'Te decimos por qué sube o baja tu riesgo' },
  { icono: iconoHabitos, titulo: 'Hábitos', detalle: 'Descubre tus hábitos de uso' },
]
const ESPERA_REENVIO = 45

function PanelMarca() {
  return (
    <section className="ac-marca" aria-label="FOCUS!">
      <img className="ac-marca__brillo ac-marca__brillo--ambar" src={brilloAmbar} alt="" aria-hidden="true" />
      <img className="ac-marca__brillo ac-marca__brillo--azul" src={brilloAzul} alt="" aria-hidden="true" />
      <div className="ac-marca__reticula" aria-hidden="true" />

      <div className="ac-marca__contenido">
        <div className="ac-marca__encabezado">
          <span className="ac-chip">
            <img src={puntoVerde} alt="" width={6} height={6} />
            PORTAL DE INVESTIGACIÓN
          </span>
          <span>v1.0 · Proyecto piloto 2025</span>
        </div>

        <div className="ac-marca__centro">
          <div className="ac-marca__logo">
            <img src={logo} alt="" width={188.72} height={188.72} />
            <div className="ac-marca__nombre">
              <p>FOCUS<span>!</span></p>
              <p>Menos pantalla, más enfoque</p>
            </div>
          </div>
          <p className="ac-marca__lema">
            Mira cómo baja tu tiempo en pantalla: tu uso del día, tu riesgo de recaída y tus horarios más difíciles.
          </p>
          <ul className="ac-marca__caracteristicas">
            {CARACTERISTICAS.map((c) => (
              <li key={c.titulo}>
                <span className="ac-marca__icono"><img src={c.icono} alt="" width={20} height={20} /></span>
                <b>{c.titulo}</b>
                <span>{c.detalle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ac-marca__institucion">
          <span className="ac-marca__uaq">UAQ</span>
          <span>
            <b>Universidad Autónoma de Querétaro</b>
            <small>Facultad de Informática · Bienestar Digital Aplicado</small>
          </span>
        </div>
      </div>
    </section>
  )
}

function Pie() {
  return (
    <p className="ac-pie">
      <img src={iconoEscudo} alt="" width={14} height={14} />
      Conexión cifrada · Aviso de privacidad · Ayuda
    </p>
  )
}

function Campo({ id, etiqueta, extra, icono, error, ayuda, children }) {
  return (
    <div className="ac-campo">
      <div className="ac-campo__etiqueta">
        <label htmlFor={id}>{etiqueta}</label>
        {extra}
      </div>
      <div className={`ac-campo__caja${error ? ' ac-campo__caja--error' : ''}`}>
        <img src={icono} alt="" width={18} height={18} />
        {children}
      </div>
      {ayuda && (
        <p className="ac-campo__ayuda" id={`${id}-ayuda`}>
          <img src={iconoAlerta} alt="" width={14} height={14} />
          {ayuda}
        </p>
      )}
    </div>
  )
}

// ---------- e1 · e2 · e3 ----------
function IniciarSesion({ email, setEmail, onEntrar, onOlvide }) {
  const [password, setPassword] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)   // { credenciales: bool, texto }
  const [aviso, setAviso] = useState('')

  async function enviar(e) {
    e.preventDefault()
    setAviso('')
    if (!email.trim() || !password) {
      setError({ credenciales: false, titulo: 'Faltan datos', texto: 'Escribe tu correo y tu contraseña para entrar.' })
      return
    }
    setError(null)
    setCargando(true)
    try {
      const r = await api.login(email.trim(), password)
      onEntrar({ id: r.usuario_id, nombre: r.nombre, email: email.trim() }, recordar)
    } catch (err) {
      setError(
        err.status === 401
          ? { credenciales: true, texto: 'Revisa los datos o usa "¿Olvidaste tu contraseña?".' }
          : { credenciales: false, texto: err.status ? err.message : `No se pudo conectar con la API (${api.base}).` },
      )
      setCargando(false)
    }
  }

  const social = () => setAviso('Por ahora entra con tu correo y contraseña: el acceso con redes aún no está disponible.')

  return (
    <form className="ac-formulario" onSubmit={enviar} noValidate>
      <div className="ac-bienvenida">
        <img src={mascota} alt="Foqui, la mascota de FOCUS!" width={72} height={72} />
        <h1 tabIndex={-1}>¡Bienvenido de vuelta!</h1>
        <p>Entra con la misma cuenta que usas en la app de tu teléfono</p>
      </div>

      {error && (
        <div className="ac-alerta" role="alert">
          <img src={iconoAviso} alt="" width={18} height={18} />
          <span>
            <b>{error.credenciales ? 'Correo o contraseña incorrectos' : error.titulo ?? 'No pudimos iniciar sesión'}</b>
            <span>{error.texto}</span>
          </span>
        </div>
      )}

      <fieldset className="ac-campos" disabled={cargando}>
        <Campo id="ac-correo" etiqueta="Correo electrónico" icono={iconoCorreo}>
          <input
            id="ac-correo"
            type="email"
            autoComplete="email"
            placeholder="tu.correo@uaq.mx"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo
          id="ac-contrasena"
          etiqueta="Contraseña"
          icono={iconoCandado}
          error={error?.credenciales}
          ayuda={error?.credenciales ? 'La contraseña no coincide con este correo.' : null}
          extra={<button type="button" className="ac-enlace" onClick={onOlvide}>¿Olvidaste tu contraseña?</button>}
        >
          <input
            id="ac-contrasena"
            type={mostrar ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••"
            required
            value={password}
            aria-invalid={error?.credenciales || undefined}
            aria-describedby={error?.credenciales ? 'ac-contrasena-ayuda' : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="ac-mostrar"
            aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={mostrar}
            onClick={() => setMostrar((m) => !m)}
          >
            <img src={iconoMostrar} alt="" width={18} height={18} />
          </button>
        </Campo>

        <label className="ac-recordar">
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          <span className="ac-recordar__casilla" aria-hidden="true">
            {recordar && <img src={iconoCheck} alt="" width={12} height={12} />}
          </span>
          Mantener la sesión iniciada
        </label>
      </fieldset>

      <div className="ac-acciones">
        <button type="submit" className="ac-boton-primario" disabled={cargando}>
          {cargando ? (
            <>
              <img className="ac-girar" src={iconoSpinner} alt="" width={16} height={16} />
              Entrando…
            </>
          ) : (
            <>
              Iniciar sesión
              <img src={iconoFlecha} alt="" width={16} height={16} />
            </>
          )}
        </button>

        <p className="ac-separador"><span>o continúa con</span></p>
        <div className="ac-redes">
          <button type="button" onClick={social} disabled={cargando}><img src={logoGoogle} alt="" width={18} height={18} />Google</button>
          <button type="button" onClick={social} disabled={cargando}><img src={logoApple} alt="" width={18} height={18} />Apple</button>
          <button type="button" className="ac-redes__facebook" onClick={social} disabled={cargando}>
            <img src={logoFacebook} alt="" width={18} height={18} />Facebook
          </button>
        </div>
        {aviso && <p className="ac-nota" role="status">{aviso}</p>}

        <p className="ac-separador"><span>o</span></p>
        <button
          type="button"
          className="ac-boton-secundario"
          disabled={cargando}
          onClick={() => onEntrar({ id: 0, nombre: 'Demo', demo: true }, false)}
        >
          <img src={iconoDemo} alt="" width={16} height={16} />
          Ver demo sin cuenta
        </button>
        {cargando && <p className="ac-nota">La primera vez del día puede tardar hasta 1 minuto.</p>}
      </div>

      <p className="ac-registro">¿Aún no tienes cuenta? Créala desde la app de tu teléfono</p>
    </form>
  )
}

// ---------- e4 ----------
function Recuperar({ email, setEmail, onVolver, onEnviado }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const valido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())

  async function enviar(e) {
    e.preventDefault()
    if (!valido) return setError('Escribe un correo válido, por ejemplo tu.correo@uaq.mx.')
    setError('')
    setCargando(true)
    try {
      await api.recuperar(email.trim())
      onEnviado()
    } catch (err) {
      setError(err.status ? err.message : `No se pudo conectar con la API (${api.base}).`)
      setCargando(false)
    }
  }

  return (
    <form className="ac-formulario ac-formulario--recuperar" onSubmit={enviar} noValidate>
      <button type="button" className="ac-volver" onClick={onVolver}>
        <img src={iconoVolver} alt="" width={16} height={16} />
        Volver al inicio de sesión
      </button>
      <span className="ac-icono-grande ac-icono-grande--ambar">
        <img src={iconoCandadoGrande} alt="" width={26} height={26} />
      </span>
      <div className="ac-titulos">
        <h1 tabIndex={-1}>Recupera tu contraseña</h1>
        <p>Escribe el correo de tu cuenta de FOCUS! y te enviaremos un enlace para crear una contraseña nueva.</p>
      </div>
      <Campo id="ac-correo-recuperar" etiqueta="Correo electrónico" icono={iconoCorreo} error={!!error} ayuda={error || null}>
        <input
          id="ac-correo-recuperar"
          type="email"
          autoComplete="email"
          placeholder="tu.correo@uaq.mx"
          required
          value={email}
          disabled={cargando}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'ac-correo-recuperar-ayuda' : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Campo>
      <button type="submit" className="ac-boton-primario ac-boton-primario--plano" disabled={cargando}>
        {cargando ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <div className="ac-pasos">
        <p>CÓMO FUNCIONA</p>
        <ol>
          <li><span>1</span>Te enviamos un enlace a tu correo</li>
          <li><span>2</span>Ábrelo desde cualquier dispositivo</li>
          <li><span>3</span>Crea tu nueva contraseña y vuelve a entrar</li>
        </ol>
      </div>
      <p className="ac-caduca">El enlace caduca en 30 minutos por seguridad.</p>
    </form>
  )
}

// ---------- e5 ----------
function Enviado({ email, onVolver }) {
  const [espera, setEspera] = useState(ESPERA_REENVIO)
  const [reenviado, setReenviado] = useState(false)

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  async function reenviar() {
    try {
      await api.recuperar(email.trim())
      setReenviado(true)
    } finally {
      setEspera(ESPERA_REENVIO)
    }
  }

  return (
    <div className="ac-formulario ac-formulario--enviado">
      <div className="ac-fila">
        <button type="button" className="ac-volver" onClick={onVolver}>
          <img src={iconoVolver} alt="" width={16} height={16} />
          Volver al inicio de sesión
        </button>
      </div>
      <span className="ac-icono-grande ac-icono-grande--verde">
        <img src={iconoCorreoGrande} alt="" width={34} height={34} />
      </span>
      <h1 tabIndex={-1}>Revisa tu correo</h1>
      <p className="ac-enviado__texto">
        Enviamos un enlace a <b>{email.trim()}</b>. Si no aparece en unos minutos, busca en la carpeta de spam.
      </p>
      <button type="button" className="ac-boton-primario ac-boton-primario--plano" onClick={onVolver}>
        Volver a iniciar sesión
      </button>
      <p className="ac-reenviar" aria-live="polite">
        <span>{reenviado && espera > 0 ? 'Lo enviamos de nuevo.' : '¿No te llegó?'}</span>
        {espera > 0 ? (
          <span className="ac-reenviar__espera">Reenviar en 0:{String(espera).padStart(2, '0')}</span>
        ) : (
          <button type="button" className="ac-enlace" onClick={reenviar}>Reenviar</button>
        )}
      </p>
      <p className="ac-ayuda">
        <img src={iconoInfo} alt="" width={18} height={18} />
        ¿Ya no usas ese correo? Escribe al equipo de investigación desde Ayuda.
      </p>
    </div>
  )
}

export default function Acceso({ onEntrar }) {
  const [vista, setVista] = useState('login')
  const [email, setEmail] = useState('')
  const panel = useRef(null)
  const primera = useRef(true)

  // Al cambiar de pantalla, el foco pasa al título del nuevo contenido (lectores de pantalla y teclado)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    panel.current?.querySelector('h1')?.focus()
  }, [vista])

  return (
    <div className="ac">
      <PanelMarca />
      <main className="ac-panel" ref={panel}>
        {vista === 'login' && (
          <IniciarSesion email={email} setEmail={setEmail} onEntrar={onEntrar} onOlvide={() => setVista('recuperar')} />
        )}
        {vista === 'recuperar' && (
          <Recuperar email={email} setEmail={setEmail} onVolver={() => setVista('login')} onEnviado={() => setVista('enviado')} />
        )}
        {vista === 'enviado' && <Enviado email={email} onVolver={() => setVista('login')} />}
        <Pie />
      </main>
    </div>
  )
}
