// "PDF" de los reportes: una página HTML sencilla que se manda a imprimir (el navegador ofrece "Guardar como PDF")
import { horas } from '../../data/plan.js'
import { escritoTexto, kpisSemana, subtitulo } from '../../data/reportes.js'

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const ESTILO = `
  body { font: 13px/1.45 Inter, system-ui, sans-serif; color: #0f172a; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 18px; margin: 28px 0 2px; }
  .sub { color: #64748b; margin: 0 0 14px; }
  .kpis { display: flex; gap: 10px; margin: 12px 0; }
  .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
  .kpi small { display: block; font-size: 10px; font-weight: 800; letter-spacing: .8px; color: #475569; }
  .kpi b { display: block; font-size: 20px; margin: 2px 0; } .kpi span { font-size: 11px; color: #64748b; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  td, th { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; text-align: left; font-size: 12px; }
  .barra { height: 10px; border-radius: 3px; background: #047857; } .barra.excede { background: #b91c1c; }
  .nota { margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: #f1f5f9; font-size: 11px; color: #475569; }
  section { break-inside: avoid; }
`

function seccion(s, parrafos) {
  const max = Math.max(1, ...s.dias.map((d) => d.min))
  return `<section>
    <h2>Semana del ${esc(s.titulo)}</h2>
    <p class="sub">${esc(s.antesDelPlan ? subtitulo(s) : escritoTexto(s))}</p>
    <div class="kpis">${kpisSemana(s).map((k) => `<div class="kpi"><small>${esc(k.etiqueta)}</small><b>${esc(k.valor)}</b><span>${esc(k.detalle)}</span></div>`).join('')}</div>
    ${parrafos.map((p) => `<p>${esc(p)}</p>`).join('')}
    <table><tr><th>Día</th><th>Uso</th><th style="width:60%"></th></tr>
      ${s.dias.map((d) => `<tr><td>${esc(d.etiqueta)}</td><td>${esc(horas(d.min))}</td><td><div class="barra${d.excede ? ' excede' : ''}" style="width:${(d.min / max) * 100}%"></div></td></tr>`).join('')}
    </table>
  </section>`
}

// semanas: [{ semana, parrafos }]
export function imprimirReporte(titulo, semanas) {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>
    <h1>${esc(titulo)}</h1>
    <p class="sub">Focus! · generado el ${esc(new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }))} · sin tu nombre ni tu correo</p>
    ${semanas.map(({ semana, parrafos }) => seccion(semana, parrafos)).join('')}
    <p class="nota">Foqui recibió solo totales, adherencia, cambio del plan y nivel de riesgo. Nunca nombres de apps ni horarios individuales.</p>
  </body></html>`
  const marco = Object.assign(document.createElement('iframe'), { title: titulo })
  Object.assign(marco.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(marco)
  marco.contentDocument.open()
  marco.contentDocument.write(html)
  marco.contentDocument.close()
  // Se quita el marco después de imprimir (o de cancelar)
  marco.contentWindow.addEventListener('afterprint', () => setTimeout(() => marco.remove(), 0))
  setTimeout(() => marco.contentWindow.print(), 50)
}
