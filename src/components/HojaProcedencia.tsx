import { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import {
  useMarketing, FUENTES_MARKETING, cantidadFuente,
  type RegistroMarketing, type TipoRegistroMarketing
} from '../hooks/useMarketing';
import { PastillaProcedencia } from './IconosMarketing';

// =========================================================================
//  HOJA DE PROCEDENCIA
//
//  Réplica del formato de Excel de la gerencia: una columna por procedencia,
//  y dos bloques separados por una línea gruesa —arriba los clientes de
//  MARKETING y abajo los de INSPECCIONES—, con subtotal de cada bloque y el
//  total general al pie.
//
//  Vive aparte para poder usarla en su propia vista y también al imprimir
//  desde el Dashboard de Marketing.
//
//  Qué es cada renglón depende de los filtros:
//    · Un taller y todo el año  → un renglón por mes.
//    · Todos los talleres       → un renglón por taller.
//    · Un taller y un mes       → un único renglón con ese mes.
// =========================================================================

// Color de texto que contrasta con un fondo hexadecimal
const colorTextoSobre = (hex: string): string => {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return '#ffffff';
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff';
};

type Fila = { clave: string; etiqueta: string; valores: Record<string, number>; total: number };

const BLOQUES: { tipo: TipoRegistroMarketing; titulo: string; color: string }[] = [
  { tipo: 'marketing', titulo: 'Marketing', color: '#1d8cf8' },
  { tipo: 'inspecciones', titulo: 'Inspecciones', color: '#8965e0' },
];

export const HojaProcedencia = ({ taller, ano, mes }: { taller: string; ano: string; mes: string }) => {
  const contexto = useContext(AppContext);
  const { registros } = useMarketing();

  const talleres = useMemo(() => contexto?.talleres ?? [], [contexto?.talleres]);
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const tallerSel = taller;
  const esTodos = tallerSel === 'Todos';
  const tallerObj = talleres.find(t => t.nombre === tallerSel) || null;
  const tallerColor = (tallerObj && (tallerObj as unknown as { color?: string }).color) || '#c0392b';

  // Columnas: el mismo orden que se configuró arrastrando en el dashboard,
  // más "Sin formulario" al final para que el total cuadre.
  const ordenGuardado = contexto?.marketingOrden;
  const columnas = useMemo(() => {
    const guardado = Array.isArray(ordenGuardado) ? ordenGuardado : [];
    const salida: { clave: string; etiqueta: string }[] = [];
    guardado.forEach(c => {
      const f = FUENTES_MARKETING.find(x => x.clave === c);
      if (f && !salida.some(s => s.clave === c)) salida.push({ clave: f.clave, etiqueta: f.etiqueta });
    });
    FUENTES_MARKETING.forEach(f => {
      if (!salida.some(s => s.clave === f.clave)) salida.push({ clave: f.clave, etiqueta: f.etiqueta });
    });
    salida.push({ clave: 'sinFormulario', etiqueta: 'Sin formulario' });
    return salida;
  }, [ordenGuardado]);

  const valorDe = (r: RegistroMarketing, clave: string) =>
    clave === 'sinFormulario' ? (r.sinFormulario > 0 ? r.sinFormulario : 0) : cantidadFuente(r, clave);

  // Renglones de un bloque (marketing o inspecciones)
  const filasDe = (tipo: TipoRegistroMarketing): Fila[] => {
    const delBloque = registros.filter(r =>
      r.tipo === tipo &&
      String(r.ano) === ano &&
      (esTodos || r.taller === tallerSel) &&
      (mes === 'Todos' || r.mes === mes)
    );

    const grupos: { clave: string; etiqueta: string }[] = esTodos
      ? talleresOrdenados.map(t => ({ clave: t.nombre, etiqueta: t.nombre }))
      : MESES.map(m => ({ clave: m, etiqueta: m }));

    return grupos
      .map(g => {
        const suyos = delBloque.filter(r => (esTodos ? r.taller : r.mes) === g.clave);
        if (suyos.length === 0) return null;
        const valores: Record<string, number> = {};
        columnas.forEach(c => { valores[c.clave] = suyos.reduce((acc, r) => acc + valorDe(r, c.clave), 0); });
        const total = Object.values(valores).reduce((a, b) => a + b, 0);
        return { clave: g.clave, etiqueta: g.etiqueta, valores, total };
      })
      .filter((x): x is Fila => x !== null);
  };

  const sumar = (filas: Fila[]): Fila => {
    const valores: Record<string, number> = {};
    columnas.forEach(c => { valores[c.clave] = filas.reduce((acc, f) => acc + (f.valores[c.clave] || 0), 0); });
    return { clave: 'total', etiqueta: 'Total', valores, total: filas.reduce((acc, f) => acc + f.total, 0) };
  };

  const bloques = BLOQUES.map(b => {
    const filas = filasDe(b.tipo);
    return { ...b, filas, subtotal: sumar(filas) };
  });
  const totalGeneral = sumar(bloques.map(b => b.subtotal));

  const etiquetaRenglon = esTodos ? 'Taller' : 'Mes';
  const titulo = `${esTodos ? 'Todos los talleres' : tallerSel} · ${mes === 'Todos' ? ano : `${mes} ${ano}`}`;

  // --- Estilos de celda tipo hoja de cálculo ---
  const celda = { border: '1px solid var(--border)', padding: '0.5rem 0.55rem', textAlign: 'center' as const, fontWeight: 700 };
  const celdaEtiqueta = { ...celda, textAlign: 'left' as const, whiteSpace: 'nowrap' as const };
  const numero = (n: number) => (n > 0 ? n.toLocaleString('en-US') : '');

  return (
    <div className="card" style={{ marginTop: 0 }}>
      {/* Barra de título, como la fila 1 del Excel */}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '56px', marginBottom: '1rem', padding: '0.5rem 4.5rem',
        backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)'
      }}>
        {!esTodos && tallerObj?.logo && (
          <img
            src={tallerObj.logo}
            alt={tallerSel}
            style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', height: '44px', width: '44px', objectFit: 'contain' }}
          />
        )}
        <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 900, fontStyle: 'italic', color: esTodos ? 'var(--text-main)' : tallerColor, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {titulo}
        </h3>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '0.85rem', color: 'var(--text-main)' }}>
          <thead>
            <tr>
              <th style={{ ...celdaEtiqueta, fontSize: '0.68rem', fontStyle: 'italic', textTransform: 'uppercase', color: 'var(--text-muted)', backgroundColor: 'var(--bg-highlight)' }}>
                {etiquetaRenglon}
              </th>
              {columnas.map(c => (
                <th key={c.clave} style={{ ...celda, fontSize: '0.64rem', fontStyle: 'italic', textTransform: 'uppercase', color: 'var(--text-muted)', backgroundColor: 'var(--bg-highlight)', lineHeight: 1.25, verticalAlign: 'bottom', minWidth: '78px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <PastillaProcedencia clave={c.clave} size={22} />
                    {c.etiqueta}
                  </div>
                </th>
              ))}
              <th style={{ ...celda, fontSize: '0.68rem', fontStyle: 'italic', textTransform: 'uppercase', color: 'var(--text-main)', backgroundColor: 'var(--bg-highlight)', minWidth: '70px' }}>
                Total
              </th>
            </tr>
          </thead>

          {bloques.map((b, i) => (
            <tbody key={b.tipo}>
              {/* Línea divisoria gruesa entre marketing e inspecciones */}
              {i > 0 && (
                <tr>
                  <td colSpan={columnas.length + 2} style={{ padding: 0, height: '6px', backgroundColor: 'var(--text-muted)', opacity: 0.55 }} />
                </tr>
              )}

              {/* Rótulo del bloque */}
              <tr>
                <td colSpan={columnas.length + 2} style={{
                  border: '1px solid var(--border)', padding: '0.45rem 0.6rem',
                  backgroundColor: b.color, color: colorTextoSobre(b.color),
                  fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.78rem'
                }}>
                  {b.titulo}
                </td>
              </tr>

              {b.filas.length === 0 ? (
                <tr>
                  <td colSpan={columnas.length + 2} style={{ ...celda, color: 'var(--text-muted)', fontWeight: 500, fontStyle: 'italic', padding: '1rem' }}>
                    Sin registros de {b.titulo.toLowerCase()} para este periodo.
                  </td>
                </tr>
              ) : (
                b.filas.map(f => (
                  <tr key={`${b.tipo}-${f.clave}`}>
                    <td style={celdaEtiqueta}>{f.etiqueta}</td>
                    {columnas.map(c => (
                      <td key={c.clave} style={celda}>{numero(f.valores[c.clave] || 0)}</td>
                    ))}
                    <td style={{ ...celda, fontWeight: 900 }}>{numero(f.total)}</td>
                  </tr>
                ))
              )}

              {/* Subtotal del bloque */}
              <tr style={{ backgroundColor: 'var(--bg-highlight)' }}>
                <td style={{ ...celdaEtiqueta, fontWeight: 800, color: b.color }}>Subtotal {b.titulo.toLowerCase()}</td>
                {columnas.map(c => (
                  <td key={c.clave} style={{ ...celda, fontWeight: 800, color: b.color }}>{numero(b.subtotal.valores[c.clave] || 0)}</td>
                ))}
                <td style={{ ...celda, fontWeight: 900, color: b.color }}>{numero(b.subtotal.total)}</td>
              </tr>
            </tbody>
          ))}

          {/* Total general, como la fila 27 del Excel */}
          <tfoot>
            <tr>
              <td colSpan={columnas.length + 2} style={{ padding: 0, height: '6px' }} />
            </tr>
            <tr style={{ backgroundColor: '#d9d9d9', color: '#111827' }}>
              <td style={{ ...celdaEtiqueta, border: '1px solid #9ca3af', fontWeight: 900, textTransform: 'uppercase' }}>Total general</td>
              {columnas.map(c => (
                <td key={c.clave} style={{ ...celda, border: '1px solid #9ca3af', fontWeight: 900 }}>
                  {(totalGeneral.valores[c.clave] || 0).toLocaleString('en-US')}
                </td>
              ))}
              <td style={{ ...celda, border: '1px solid #9ca3af', fontWeight: 900, fontSize: '1rem' }}>
                {totalGeneral.total.toLocaleString('en-US')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ margin: '0.85rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Los clientes de inspecciones se capturan en <strong>Marketing → Registro</strong> eligiendo el tipo
        <em> Inspecciones</em>. Los registros anteriores cuentan como marketing.
      </p>
      </div>
  );
};
