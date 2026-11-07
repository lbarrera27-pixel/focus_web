import { useState } from 'react'
import Icono from '../../components/Icono.jsx'
import iconoMas from '../../assets/icons/aj-mas.svg'
import iconoBuscarCirculo from '../../assets/icons/aj-buscar-circulo.svg'
import iconoBuscarMango from '../../assets/icons/aj-buscar-mango.svg'
import iconoBotonConfig from '../../assets/icons/aj-boton-config.svg'
import logoInstagram from '../../assets/icons/logo-instagram.svg'
import logoTiktok from '../../assets/icons/logo-tiktok.svg'
import logoX from '../../assets/icons/logo-x.svg'
import logoYoutube from '../../assets/icons/logo-youtube.svg'
import logoFacebook from '../../assets/icons/logo-facebook.svg'
import logoClash from '../../assets/icons/logo-clash.png'
import { Cabecera, Chip, ChipNivel, Interruptor, Nota, Pasos } from './Comunes.jsx'
import { etiquetaCategoria, pausasDeHoy, resumenApps } from '../../data/ajustes.js'
import { api } from '../../api.js'
import Dialogo from '../../components/web/Dialogo.jsx'
import { useAvisos } from '../../components/web/Avisos.jsx'
import iconoDialogoApp from '../../assets/icons/w-dlg-app.svg'

// Logos del diseño para los paquetes conocidos; el resto usa la inicial de la app
const LOGOS = {
  'com.instagram.android': { src: logoInstagram, gradiente: true },
  'com.zhiliaoapp.musically': { src: logoTiktok },
  'com.twitter.android': { src: logoX },
  'com.google.android.youtube': { src: logoYoutube },
  'com.facebook.katana': { src: logoFacebook },
  'com.supercell.clashroyale': { src: logoClash },
}

function Logo({ app, tam = 38 }) {
  const logo = LOGOS[app.paquete]
  if (!logo) return <span className="aj-logo aj-logo--inicial" style={{ width: tam, height: tam }}>{app.nombre.charAt(0).toUpperCase()}</span>
  return (
    <span className={`aj-logo${logo.gradiente ? ' aj-logo--instagram' : ''}`} style={{ width: tam, height: tam }}>
      <img src={logo.src} alt="" />
    </span>
  )
}

const FILTROS = [
  { id: null, etiqueta: 'Todas' },
  { id: 'social', etiqueta: 'Redes sociales' },
  { id: 'video', etiqueta: 'Video' },
  { id: 'juegos', etiqueta: 'Juegos' },
]

const COLOR_NIVEL = { 1: '#fbbf24', 2: '#38bdf8', 3: '#f87171' }

// Paquetes de Android de las apps más comunes; si el nombre no está aquí se pide el paquete
const PAQUETES = {
  instagram: 'com.instagram.android', tiktok: 'com.zhiliaoapp.musically', youtube: 'com.google.android.youtube',
  x: 'com.twitter.android', twitter: 'com.twitter.android', facebook: 'com.facebook.katana', whatsapp: 'com.whatsapp',
  snapchat: 'com.snapchat.android', netflix: 'com.netflix.mediaclient', twitch: 'tv.twitch.android.app',
  reddit: 'com.reddit.frontpage', discord: 'com.discord', telegram: 'org.telegram.messenger', spotify: 'com.spotify.music',
  pinterest: 'com.pinterest', threads: 'com.instagram.barcelona', 'clash royale': 'com.supercell.clashroyale',
  'free fire': 'com.dts.freefireth', roblox: 'com.roblox.client', 'candy crush': 'com.king.candycrushsaga',
}
const CATEGORIAS = [
  { id: 'social', texto: 'Redes sociales' },
  { id: 'video', texto: 'Video' },
  { id: 'juegos', texto: 'Juegos' },
  { id: 'otra', texto: 'Otra' },
]

// Figma e22: diálogo "Agregar app restringida"
function NuevaApp({ usuario, onCreada, onCancelar }) {
  const [form, setForm] = useState({ nombre: '', paquete: '', categoria: 'social', limite: 10, friccion: true })
  const [estado, setEstado] = useState({ enviando: false, error: null })
  const conocido = PAQUETES[form.nombre.trim().toLowerCase()]
  const paquete = conocido ?? form.paquete.trim()
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function enviar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return setEstado({ enviando: false, error: 'Escribe el nombre de la app.' })
    if (!paquete) return setEstado({ enviando: false, error: 'Escribe el paquete de Android (aparece en el enlace de Google Play).' })
    setEstado({ enviando: true, error: null })
    try {
      const cuerpo = { nombre: form.nombre.trim(), paquete, categoria: form.categoria, limite_aperturas: form.limite }
      const creada = usuario.demo ? { ...cuerpo, numero: null } : await api.crearApp(usuario.id, cuerpo)
      onCreada(creada, form.friccion)
    } catch (err) {
      setEstado({ enviando: false, error: err.message || 'Sin conexión' })
    }
  }

  return (
    <Dialogo icono={iconoDialogoApp} titulo="Agregar app restringida" ancho={520} onCerrar={onCancelar}
      detalle="Focus! aplicará fricción progresiva cuando se supere el límite de aperturas."
      nota={usuario.demo ? 'Demo: no se envía a la API' : 'Se aplica en tu teléfono al guardar'}
      acciones={(
        <>
          <button type="button" className="w-dlg-boton w-dlg-boton--secundario" onClick={onCancelar}>Cancelar</button>
          <button type="submit" form="aj-nueva-app" className="w-dlg-boton w-dlg-boton--primario" disabled={estado.enviando}>
            {estado.enviando ? 'Agregando…' : 'Agregar app'}
          </button>
        </>
      )}>
      <form id="aj-nueva-app" className="aj-dlg" noValidate onSubmit={enviar}>
        <label className="w-campo">
          <span>Nombre de la app</span>
          <input value={form.nombre} maxLength={120} placeholder="Instagram" onChange={(e) => set('nombre', e.target.value)} />
        </label>
        {form.nombre.trim() && !conocido && (
          <label className="w-campo">
            <span>Paquete de Android</span>
            <input value={form.paquete} maxLength={255} placeholder="com.ejemplo.app" spellCheck={false} onChange={(e) => set('paquete', e.target.value)} />
          </label>
        )}
        <div className="w-campo">
          <span id="aj-dlg-categoria">Categoría</span>
          <div className="w-segmentos" role="radiogroup" aria-labelledby="aj-dlg-categoria">
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={form.categoria === c.id} onClick={() => set('categoria', c.id)}>{c.texto}</button>
            ))}
          </div>
        </div>
        <div className="aj-dlg__limite">
          <div>
            <b>Límite de aperturas por día</b>
            <span>Después se muestra la pausa consciente</span>
          </div>
          <span className="w-pasos">
            <button type="button" aria-label="Reducir límite" disabled={form.limite <= 0} onClick={() => set('limite', form.limite - 1)}>−</button>
            <b aria-live="polite">{form.limite}</b>
            <button type="button" aria-label="Aumentar límite" disabled={form.limite >= 100} onClick={() => set('limite', form.limite + 1)}>+</button>
          </span>
        </div>
        <div className="aj-dlg__friccion">
          <span id="aj-dlg-friccion">Activar fricción progresiva (niveles 1 → 3)</span>
          <button type="button" role="switch" className="w-interruptor" aria-checked={form.friccion} aria-labelledby="aj-dlg-friccion"
            onClick={() => set('friccion', !form.friccion)} />
        </div>
        {estado.error && <p className="w-campo__error" role="alert">{estado.error}</p>}
      </form>
    </Dialogo>
  )
}

export default function TabApps({ usuario, datos, locales, setLocales, borrador, setBorrador, original, onRecargar }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState(null)
  const [editando, setEditando] = useState(null)
  const [nueva, setNueva] = useState(false)
  const avisar = useAvisos()

  const apps = resumenApps(datos)
  const inactivas = new Set(locales.appsInactivas)
  const q = busqueda.trim().toLowerCase()
  const visibles = apps.filter(
    (a) => (!filtro || a.grupo === filtro) && (!q || a.nombre.toLowerCase().includes(q) || a.paquete.toLowerCase().includes(q)),
  )
  const hoy = pausasDeHoy(datos)

  // Distribución de apps por el nivel de fricción que más se les aplica
  const porNivel = [1, 2, 3].map((n) => ({ nivel: n, apps: apps.filter((a) => a.nivel === n) }))
  const conNivel = apps.filter((a) => a.nivel).length || 1
  const top = [...apps].sort((a, b) => b.pausas7 - a.pausas7).filter((a) => a.pausas7 > 0).slice(0, 4)
  const maxPausas = Math.max(1, ...top.map((a) => a.pausas7))

  const alternar = (numero, activa) =>
    setLocales((l) => ({ ...l, appsInactivas: activa ? l.appsInactivas.filter((n) => n !== numero) : [...l.appsInactivas, numero] }))
  const cambiarLimite = (numero, delta) =>
    setBorrador((b) => ({ ...b, limitesApps: { ...b.limitesApps, [numero]: Math.max(0, Math.min(100, b.limitesApps[numero] + delta)) } }))

  return (
    <div className="aj-grid aj-grid--apps">
      <section className="aj-panel">
        <Cabecera
          etiqueta="APPS MONITORIZADAS"
          titulo="Catálogo de Apps Restringidas"
          desc="Administra todas las apps y su nivel de intervención antes de abrirse."
          extra={<Chip>{apps.length - apps.filter((a) => inactivas.has(a.numero)).length} activas</Chip>}
        />
        <div className="aj-filtros">
          <label className="aj-buscar">
            <span className="aj-buscar__icono" aria-hidden="true">
              <img src={iconoBuscarCirculo} alt="" className="aj-buscar__circulo" />
              <img src={iconoBuscarMango} alt="" className="aj-buscar__mango" />
            </span>
            <input type="search" placeholder="Buscar app o paquete..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </label>
          {FILTROS.map((f) => (
            <button
              key={f.etiqueta}
              type="button"
              aria-pressed={filtro === f.id}
              className={`aj-filtro${filtro === f.id ? ' aj-filtro--activo' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>

        <div className="aj-tabla__cabeza">
          <small>APP</small>
          <small>CATEGORÍA</small>
          <small>FRICCIÓN</small>
          <small>LÍMITE DIARIO</small>
          <small>USO HOY</small>
        </div>
        <div className="aj-tabla">
          {visibles.length ? (
            visibles.map((a) => {
              const activa = !inactivas.has(a.numero)
              const limite = borrador.limitesApps[a.numero]
              const cambiado = limite !== original.limitesApps[a.numero]
              const lleno = limite > 0 && a.aperturasHoy >= limite
              return (
                <div key={a.numero} className={`aj-fila${activa ? '' : ' aj-fila--inactiva'}`}>
                  <Logo app={a} />
                  <span className="aj-fila__app">
                    <b>{a.nombre}</b>
                    <small>{a.paquete}</small>
                  </span>
                  <span><span className="aj-categoria">{etiquetaCategoria(a.categoria)}</span></span>
                  <span><ChipNivel nivel={a.nivel} /></span>
                  <span className="aj-fila__limite">
                    <b className={cambiado ? 'aj-cambiado' : ''}>{limite} aperturas</b>
                    {editando === a.numero && (
                      <Pasos
                        etiqueta={`el límite de ${a.nombre}`}
                        deshabilitarMenos={limite <= 0}
                        deshabilitarMas={limite >= 100}
                        onMenos={() => cambiarLimite(a.numero, -1)}
                        onMas={() => cambiarLimite(a.numero, 1)}
                      />
                    )}
                  </span>
                  <span className="aj-fila__uso">
                    <b className={lleno ? 'aj-rojo' : ''}>{a.aperturasHoy} / {limite} aperturas</b>
                    <span className="aj-barra-uso">
                      <span style={{ width: `${limite ? Math.min(100, (a.aperturasHoy / limite) * 100) : 0}%`, background: lleno ? '#ef4444' : '#f59e0b' }} />
                    </span>
                  </span>
                  <button
                    type="button"
                    className={`aj-boton-config${editando === a.numero ? ' aj-boton-config--activo' : ''}`}
                    aria-label={`Configurar ${a.nombre}`}
                    aria-expanded={editando === a.numero}
                    onClick={() => setEditando(editando === a.numero ? null : a.numero)}
                  >
                    <img src={iconoBotonConfig} alt="" />
                  </button>
                  <Interruptor activo={activa} etiqueta={`Fricción para ${a.nombre}`} onCambio={(v) => alternar(a.numero, v)} />
                </div>
              )
            })
          ) : (
            <p className="vacio">{apps.length ? 'Ninguna app coincide con el filtro.' : 'Aún no hay apps registradas.'}</p>
          )}
        </div>

        <button type="button" className="aj-boton-punteado" onClick={() => setNueva(true)}>
          <Icono src={iconoMas} tam={16} />
          Añadir nueva app restringida
        </button>
        {nueva && (
          <NuevaApp
            usuario={usuario}
            onCancelar={() => setNueva(false)}
            onCreada={(app, friccion) => {
              setNueva(false)
              // Sin fricción la app queda registrada pero desactivada (se guarda con "Guardar")
              if (!friccion && app.numero != null) alternar(app.numero, false)
              avisar({
                tono: usuario.demo ? 'alerta' : 'exito',
                titulo: usuario.demo ? `${app.nombre} no se agregó (demo)` : `${app.nombre} agregada`,
                detalle: usuario.demo ? 'En la demo no se crean apps en la API.' : `Límite de ${app.limite_aperturas} aperturas al día.`,
              })
              if (!usuario.demo) onRecargar()
            }}
          />
        )}
        <div className="aj-pie">
          <Nota>
            El límite (aperturas por día) y las apps desactivadas se guardan en tu cuenta en la nube.
          </Nota>
        </div>
      </section>

      <section className="aj-panel">
        <Cabecera
          etiqueta="RESUMEN DE INTERVENCIONES"
          titulo="Fricción Activa Hoy"
          desc="Cómo se aplican los niveles en tus apps."
          extra={<Chip>{hoy.total} pausas</Chip>}
        />
        <div className="aj-stats">
          <div><small>PAUSAS MOSTRADAS</small><b>{hoy.total}</b></div>
          <div><small>ABANDONARON</small><b className="aj-verde">{hoy.abandonaron}</b></div>
          <div><small>CONTINUARON</small><b className="aj-ambar">{hoy.continuaron}</b></div>
        </div>

        <p className="aj-subtitulo">DISTRIBUCIÓN POR NIVEL · ÚLTIMOS 7 DÍAS</p>
        <div className="aj-distribucion">
          {porNivel.map(({ nivel, apps: lista }) => (
            <div key={nivel} className="aj-distribucion__fila">
              <ChipNivel nivel={nivel} />
              <span>
                <b>{lista.length ? lista.map((a) => a.nombre).join(' · ') : 'Ninguna app'}</b>
                <span className="aj-barra-uso aj-barra-uso--larga">
                  <span style={{ width: `${(lista.length / conNivel) * 100}%`, background: COLOR_NIVEL[nivel] }} />
                </span>
              </span>
              <strong>{lista.length} app{lista.length === 1 ? '' : 's'}</strong>
            </div>
          ))}
        </div>

        <p className="aj-subtitulo">APPS CON MÁS PAUSAS · ÚLTIMOS 7 DÍAS</p>
        <div className="aj-top">
          {top.length ? (
            top.map((a) => (
              <div key={a.numero} className="aj-top__fila">
                <Logo app={a} tam={28} />
                <span>
                  <b>{a.nombre}</b>
                  <span className="aj-barra-uso aj-barra-uso--top">
                    <span style={{ width: `${(a.pausas7 / maxPausas) * 100}%` }} />
                  </span>
                </span>
                <strong>{a.pausas7} pausas</strong>
              </div>
            ))
          ) : (
            <p className="vacio">Sin pausas registradas esta semana.</p>
          )}
        </div>
        <div className="aj-pie">
          <Nota>Los niveles suben solos si detectamos recaídas.</Nota>
        </div>
      </section>
    </div>
  )
}
