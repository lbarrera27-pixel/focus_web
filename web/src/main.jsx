import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import './tema-oscuro.css'
import { aplicarTema, leerTema } from './components/TemaInterruptor.jsx'

// El tema guardado se aplica antes de pintar para que no parpadee
aplicarTema(leerTema())

// El diseño mide 1440 px de ancho: en pantallas más anchas se amplía para ocupar todo el ancho
const ANCHO_DISENO = 1440
// Se mide sin la barra de desplazamiento (clientWidth): con innerWidth el contenido se salía unos 15 px
function ajustarZoom() {
  const zoom = Math.max(1, document.documentElement.clientWidth / ANCHO_DISENO)
  const raiz = document.getElementById('root')
  if (raiz.style.zoom === String(zoom)) return
  raiz.style.zoom = zoom
  document.documentElement.style.setProperty('--zoom', zoom)
}
ajustarZoom()
// También cambia el ancho útil cuando aparece o desaparece la barra de desplazamiento
new ResizeObserver(ajustarZoom).observe(document.documentElement)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
