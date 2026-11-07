// Interruptor de tema claro / oscuro con sol y luna. Usa la misma píldora ámbar que el resto de los switches.
// El tema se guarda en este navegador y se aplica con data-tema en <html> (ver index.css y scripts/tema_oscuro.py).
import { useState } from 'react'

const CLAVE = 'focus.tema'

export function leerTema() {
  try {
    const t = localStorage.getItem(CLAVE)
    if (t === 'oscuro' || t === 'claro') return t
  } catch {
    // sin almacenamiento: se usa el claro
  }
  return 'claro'
}

export function aplicarTema(tema, { animar = false } = {}) {
  const raiz = document.documentElement
  if (animar) {
    raiz.classList.add('tema-transicion')
    setTimeout(() => raiz.classList.remove('tema-transicion'), 260)
  }
  raiz.dataset.tema = tema
}

export default function TemaInterruptor({ contraido }) {
  const [tema, setTema] = useState(leerTema)
  const oscuro = tema === 'oscuro'
  function cambiar() {
    const nuevo = oscuro ? 'claro' : 'oscuro'
    setTema(nuevo)
    aplicarTema(nuevo, { animar: true })
    try {
      localStorage.setItem(CLAVE, nuevo)
    } catch {
      // sin almacenamiento: dura esta visita
    }
  }
  const etiqueta = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  return (
    <div className={`menu__tema${contraido ? ' menu__tema--contraido' : ''}`}>
      {!contraido && <span className="menu__tema-icono" aria-hidden="true">☀️</span>}
      <button type="button" role="switch" aria-checked={oscuro} aria-label={etiqueta} title={etiqueta}
        className="w-interruptor menu__tema-switch" onClick={cambiar}>
        {contraido && <span className="menu__tema-mini" aria-hidden="true">{oscuro ? '🌙' : '☀️'}</span>}
      </button>
      {!contraido && <span className="menu__tema-icono" aria-hidden="true">🌙</span>}
      {!contraido && <span className="menu__tema-texto">{oscuro ? 'Modo oscuro' : 'Modo claro'}</span>}
    </div>
  )
}
