"""Genera el modo oscuro del portal a partir de los colores fijos de cada hoja de estilos.

Para cada archivo .css de web/src agrega (o reemplaza) al final un bloque marcado con las mismas reglas
bajo :root[data-tema='oscuro'], con los colores claros cambiados por su versión oscura:
  - fondos claros neutros  -> superficies oscuras (#182234, #1e293b, ...)
  - fondos pastel          -> el mismo tono translúcido sobre oscuro
  - textos oscuros         -> grises claros; textos de color oscuros -> el mismo tono aclarado
  - bordes claros          -> bordes oscuros sutiles
Las variables (--w-texto, --fondo, ...) se cambian a mano en index.css.

Uso (desde la carpeta web):  python scripts/tema_oscuro.py
Vuelve a correrlo después de cambiar colores en cualquier .css.
"""
import colorsys
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent / 'src'
INICIO = '/* ==== tema oscuro (generado por scripts/tema_oscuro.py; no editar a mano) ==== */'
FIN = '/* ==== fin del tema oscuro ==== */'
PREFIJO = ":root[data-tema='oscuro']"
# El acceso tiene su propio panel oscuro y el menú lateral ya es oscuro
OMITIR = {'Acceso.css', 'Menu.css'}

FONDO = {'background', 'background-color', 'background-image', 'fill'}
TEXTO = {'color', 'caret-color', '-webkit-text-fill-color'}
BORDE = {'border', 'border-color', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-top-color',
         'border-bottom-color', 'border-left-color', 'border-right-color', 'outline', 'outline-color', 'stroke',
         'text-decoration-color', 'box-shadow', 'accent-color'}

COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b')


def leer(c):
    c = c.strip().lower()
    if c == 'white':
        return 255, 255, 255, 1.0
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4):
            h = ''.join(x * 2 for x in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r, g, b, a
    n = [x.strip() for x in c[c.index('(') + 1:-1].replace('/', ',').split(',')]
    if any('%' in x for x in n[:3]):
        return None
    r, g, b = (float(x) for x in n[:3])
    a = float(n[3].rstrip('%')) / (100 if n[3].endswith('%') else 1) if len(n) > 3 else 1.0
    return r, g, b, a


def hsl(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l


def texto(rgb, a=1.0):
    r, g, b = rgb
    return f'#{r:02x}{g:02x}{b:02x}' if a >= 1 else f'rgba({r}, {g}, {b}, {round(a, 3)})'


def hex3(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mapear(c, tipo):
    v = leer(c)
    if v is None:
        return c
    r, g, b, a = v
    h, s, l = hsl(r, g, b)
    neutro = s < 0.2 or (max(r, g, b) - min(r, g, b)) < 18
    if tipo == 'fondo':
        if neutro:
            if l >= 0.975:
                return texto(hex3('#182234'), a)
            if l >= 0.93:
                return texto(hex3('#1e293b'), a)
            if l >= 0.85:
                return texto(hex3('#2b3a52'), a)
            if l >= 0.75:
                return texto(hex3('#3b4a61'), a)
            return c
        if l >= 0.8:  # pastel
            return f'hsla({round(h)}, 70%, 50%, {round(0.16 * a, 3)})'
        return c
    if tipo == 'borde':
        if neutro:
            if l >= 0.85:
                return texto(hex3('#2a3649'), a)
            if l >= 0.75:
                return texto(hex3('#3b4a61'), a)
            return c
        if l >= 0.8:
            return f'hsla({round(h)}, 70%, 55%, {round(0.4 * a, 3)})'
        return c
    # texto
    if neutro:
        if l < 0.2:
            return texto(hex3('#f8fafc'), a)
        if l < 0.32:
            return texto(hex3('#e2e8f0'), a)
        if l < 0.45:
            return texto(hex3('#cbd5e1'), a)
        if l < 0.55:
            return texto(hex3('#94a3b8'), a)
        return c
    if l < 0.45 and s > 0.3:
        rr, gg, bb = colorsys.hls_to_rgb(h / 360, 0.7, min(s, 0.9))
        return texto((round(rr * 255), round(gg * 255), round(bb * 255)), a)
    return c


def vivo(valor):
    """El fondo tiene un color fuerte (botón ámbar, chip verde…): su texto se deja como está."""
    for c in COLOR.findall(valor):
        v = leer(c)
        if v and v[3] > 0.5:
            h, s, l = hsl(*v[:3])
            if s > 0.45 and 0.3 < l < 0.75:
                return True
    return False


def declaraciones(cuerpo):
    out = []
    for d in re.split(r';(?![^(]*\))', cuerpo):
        if ':' not in d:
            continue
        p, v = d.split(':', 1)
        out.append((p.strip().lower(), v.strip()))
    return out


def regla(selectores, cuerpo):
    decl = declaraciones(cuerpo)
    fondo_vivo = any(p in FONDO and vivo(v) for p, v in decl)
    cambios, hay_color = [], False
    for p, v in decl:
        tipo = 'fondo' if p in FONDO else 'texto' if p in TEXTO else 'borde' if p in BORDE else None
        if not tipo or 'var(' in v and not COLOR.search(v):
            continue
        if not COLOR.search(v):
            continue
        hay_color = True
        if tipo == 'texto' and fondo_vivo:
            nuevo = v
        else:
            nuevo = COLOR.sub(lambda m: mapear(m.group(0), tipo), v)
        cambios.append((p, nuevo, nuevo != v))
    # Se copian también las reglas sin cambios para que los estados (activo, hover…) sigan ganando
    # en el mismo orden que en el tema claro
    if not hay_color:
        return None
    sel = ', '.join(f'{PREFIJO} {x.strip()}' if not x.strip().startswith(':root') else x.strip().replace(':root', PREFIJO, 1)
                    for x in selectores.split(','))
    return f'{sel} {{ ' + '; '.join(f'{p}: {v}' for p, v, _ in cambios) + '; }'


def procesar(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    out, i = [], 0
    while True:
        m = re.compile(r'([^{}]+)\{').search(css, i)
        if not m:
            break
        cab = m.group(1).strip()
        if cab.startswith('@media') or cab.startswith('@supports'):
            # bloque anidado: buscar su cierre
            nivel, j = 1, m.end()
            while nivel and j < len(css):
                nivel += {'{': 1, '}': -1}.get(css[j], 0)
                j += 1
            interno = procesar(css[m.end():j - 1])
            if interno:
                out.append(f'{cab} {{\n' + '\n'.join('  ' + x for x in interno) + '\n}')
            i = j
            continue
        if cab.startswith('@'):
            nivel, j = 1, m.end()
            while nivel and j < len(css):
                nivel += {'{': 1, '}': -1}.get(css[j], 0)
                j += 1
            i = j
            continue
        fin = css.index('}', m.end())
        if cab != ':root' and not cab.startswith(':root '):
            r = regla(cab, css[m.end():fin])
            if r:
                out.append(r)
        i = fin + 1
    return out


def main():
    total = 0
    for f in sorted(RAIZ.rglob('*.css')):
        if f.name in OMITIR:
            continue
        s = f.read_text(encoding='utf-8')
        if INICIO in s:
            s = s[:s.index(INICIO)].rstrip() + '\n'
        reglas = procesar(s)
        if reglas:
            s += f'\n{INICIO}\n' + '\n'.join(reglas) + f'\n{FIN}\n'
            total += len(reglas)
        f.write_text(s, encoding='utf-8')
    print(f'{total} reglas oscuras generadas')


if __name__ == '__main__':
    main()
