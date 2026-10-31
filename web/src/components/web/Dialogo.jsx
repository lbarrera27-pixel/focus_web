// Diálogo base del portal (Figma e22, e27, e30): fondo oscuro, Esc o clic fuera para cerrar.
import { useEffect, useRef } from 'react'
import iconoCerrar from '../../assets/icons/w-dlg-cerrar.svg'
import './web.css'

export default function Dialogo({ icono, tono = 'marca', titulo, detalle, onCerrar, children, acciones, nota, ancho = 520, className = '' }) {
  const caja = useRef(null)
  // En un ref para no reenfocar el primer campo cada vez que el padre vuelve a renderizar
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    const previo = document.activeElement
    // Foco en el primer campo, o si no hay, en el primer botón de acciones
    const primero = caja.current?.querySelector('input, select, textarea') ?? caja.current?.querySelector('.w-dialogo__acciones button')
    primero?.focus()
    const alTeclear = (e) => {
      if (e.key === 'Escape') cerrar.current()
      if (e.key !== 'Tab' || !caja.current) return
      // Mantiene el foco dentro del diálogo
      const enfocables = [...caja.current.querySelectorAll('button:not(:disabled), input, select, textarea')]
      if (!enfocables.length) return
      const [ini, fin] = [enfocables[0], enfocables[enfocables.length - 1]]
      if (e.shiftKey && document.activeElement === ini) {
        e.preventDefault()
        fin.focus()
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault()
        ini.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      previo?.focus?.()
    }
  }, [])

  return (
    <div className="w-velo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div ref={caja} className={`w-dialogo ${className}`} style={{ width: ancho }} role="dialog" aria-modal="true" aria-labelledby="w-dialogo-titulo">
        <div className="w-dialogo__encabezado">
          {icono && <span className={`w-dialogo__icono w-dialogo__icono--${tono}`}><img src={icono} alt="" /></span>}
          <div className="w-dialogo__texto">
            <h2 id="w-dialogo-titulo">{titulo}</h2>
            {detalle && <p>{detalle}</p>}
          </div>
          <button type="button" className="w-dialogo__cerrar" aria-label="Cerrar" onClick={onCerrar}>
            <img src={iconoCerrar} alt="" />
          </button>
        </div>
        {children}
        {acciones && (
          <>
            <div className="w-divisor" />
            <div className="w-dialogo__acciones">
              {nota && <p className="w-dialogo__nota">{nota}</p>}
              {acciones}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
