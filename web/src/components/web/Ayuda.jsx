// Ayuda contextual: botón "?" con un globo que explica qué es el dato y qué puede hacer la persona,
// y un globo genérico para los elementos de las gráficas (puntos, celdas, barras).
// El globo se dibuja en <body> con position: fixed para que no lo recorte el overflow de las tarjetas.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Ayuda.css'

const MARGEN = 8

// Globo flotante junto a `ancla` (DOMRect). Abajo si cabe; si no, arriba. Nunca se sale de la ventana.
export function Globo({ ancla, id, children, ancho = 260 }) {
  const caja = useRef(null)
  const [pos, setPos] = useState({ left: -9999, top: -9999 })

  useLayoutEffect(() => {
    if (!ancla || !caja.current) return
    const { offsetWidth: w, offsetHeight: h } = caja.current
    const abajo = ancla.bottom + MARGEN + h <= window.innerHeight
    const top = abajo ? ancla.bottom + MARGEN : Math.max(MARGEN, ancla.top - MARGEN - h)
    const centro = ancla.left + ancla.width / 2
    const left = Math.min(Math.max(MARGEN, centro - w / 2), window.innerWidth - w - MARGEN)
    setPos({ left, top })
  }, [ancla, children])

  if (!ancla) return null
  return createPortal(
    <div ref={caja} id={id} role="tooltip" className="ayuda-globo" style={{ ...pos, maxWidth: ancho }}>
      {children}
    </div>,
    document.body,
  )
}

// Para gráficas: mostrar(elemento, contenido) al pasar el ratón o enfocar; ocultar() al salir
export function useGlobo() {
  const id = useId()
  const [estado, setEstado] = useState(null)
  const mostrar = useCallback((elemento, contenido) => setEstado({ elemento, ancla: elemento.getBoundingClientRect(), contenido }), [])
  const ocultar = useCallback(() => setEstado(null), [])
  const abierto = Boolean(estado)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e) => e.key === 'Escape' && setEstado(null)
    // Al desplazar (también cuando el foco lleva el elemento a la vista) el globo lo sigue
    const alMover = () => setEstado((e) => e && { ...e, ancla: e.elemento.getBoundingClientRect() })
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('scroll', alMover, true)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('scroll', alMover, true)
    }
  }, [abierto])

  // Props para cualquier elemento enfocable de la gráfica
  const props = (contenido) => ({
    onMouseEnter: (e) => mostrar(e.currentTarget, contenido),
    onMouseLeave: ocultar,
    onFocus: (e) => mostrar(e.currentTarget, contenido),
    onBlur: ocultar,
    'aria-describedby': estado ? id : undefined,
  })

  const globo = estado && <Globo ancla={estado.ancla} id={id}>{estado.contenido}</Globo>
  return { props, globo, ocultar }
}

// Botón "?" junto a un título. `que`: qué representa el dato; `accion`: qué puede hacer la persona.
export default function Ayuda({ titulo, que, accion, claro = false }) {
  const id = useId()
  const boton = useRef(null)
  const [ancla, setAncla] = useState(null)
  const fijo = useRef(false)   // abierto con clic/toque: no se cierra al quitar el ratón
  const abrir = () => setAncla(boton.current.getBoundingClientRect())
  const cerrar = () => {
    fijo.current = false
    setAncla(null)
  }

  const abierto = Boolean(ancla)
  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e) => e.key === 'Escape' && cerrar()
    const alPulsar = (e) => !boton.current?.contains(e.target) && cerrar()
    // Al desplazar, el globo sigue al botón
    const alMover = () => boton.current && setAncla(boton.current.getBoundingClientRect())
    window.addEventListener('keydown', alTeclear)
    window.addEventListener('pointerdown', alPulsar)
    window.addEventListener('scroll', alMover, true)
    return () => {
      window.removeEventListener('keydown', alTeclear)
      window.removeEventListener('pointerdown', alPulsar)
      window.removeEventListener('scroll', alMover, true)
    }
  }, [abierto])

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={`ayuda-boton${claro ? ' ayuda-boton--claro' : ''}`}
        aria-label={`Qué significa: ${titulo}`}
        aria-describedby={ancla ? id : undefined}
        aria-expanded={Boolean(ancla)}
        onMouseEnter={abrir}
        onMouseLeave={() => !fijo.current && setAncla(null)}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={() => {
          fijo.current = !fijo.current
          if (fijo.current) abrir()
          else setAncla(null)
        }}
      >
        ?
      </button>
      {ancla && (
        <Globo ancla={ancla} id={id} ancho={300}>
          <b className="ayuda-globo__titulo">{titulo}</b>
          <span>{que}</span>
          {accion && (
            <span className="ayuda-globo__accion">
              <b>Qué puedes hacer:</b> {accion}
            </span>
          )}
        </Globo>
      )}
    </>
  )
}
