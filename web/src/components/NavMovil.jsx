// Navegación en teléfonos (< 768 px): barra superior con la marca, el tema y la cuenta, y barra inferior
// fija con las secciones. En pantallas más anchas se oculta y se usa el menú lateral (Menu.jsx).
import { useEffect, useState } from 'react'
import Icono from './Icono.jsx'
import TemaInterruptor from './TemaInterruptor.jsx'
import { AvatarUsuario, SECCIONES_ESTUDIANTE } from './Menu.jsx'
import './NavMovil.css'

const CONSULTA = '(max-width: 767px)'

export function useEsMovil() {
  const [movil, setMovil] = useState(() => window.matchMedia(CONSULTA).matches)
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA)
    const alCambiar = () => setMovil(mq.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])
  return movil
}

const TONOS = {
  azul: '#7dd3fc', verde: '#6ee7b7', rojo: '#fda4af', ambar: '#fbbf24',
  violeta: '#c4b5fd', cian: '#67e8f9', indigo: '#a5b4fc', gris: '#e2e8f0',
}

export default function NavMovil({ activa, onNavegar, usuario, foto, onUsuario, usuarioAbierto, children }) {
  return (
    <>
      <header className="movil-cabecera">
        <span className="movil-cabecera__logo">FOCUS<span>!</span></span>
        <TemaInterruptor contraido />
        <button type="button" className="movil-cabecera__usuario" onClick={onUsuario} aria-haspopup="menu" aria-expanded={usuarioAbierto}
          aria-label={`Cuenta de ${usuario.nombre}`}>
          <AvatarUsuario className="movil-cabecera__inicial" nombre={usuario.nombre} foto={foto} />
        </button>
        {children}
      </header>
      <nav className="movil-nav" aria-label="Navegación principal">
        {SECCIONES_ESTUDIANTE.map((s) => {
          const esActiva = s.id === activa
          return (
            <button key={s.id} type="button" className={`movil-nav__item${esActiva ? ' movil-nav__item--activo' : ''}`}
              aria-current={esActiva ? 'page' : undefined} aria-label={s.titulo} title={s.titulo} onClick={() => onNavegar(s.id)}
              style={esActiva ? { '--tono': TONOS[s.tono] } : undefined}>
              <Icono src={s.icono} tam={20} tinta={esActiva ? TONOS[s.tono] : '#94a3b8'} />
            </button>
          )
        })}
      </nav>
    </>
  )
}
