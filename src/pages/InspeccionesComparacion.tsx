import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { GitCompare, Filter, TrendingUp, TrendingDown, Minus, Sigma } from 'lucide-react';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';

// =========================================================================
//  COMPARACIÓN DE INSPECCIONES (AÑO VS AÑO)
//  Estructura basada en el Excel de referencia:
//    Fila 1: Taller - Año base        (cantidades por mes)
//    Fila 2: Taller - Año a comparar  (cantidades por mes)
//    Fila 3: DIFERENCIA               ("N MENOS" / "N CRECIMIENTO" / "NO CRECIMIENTO")
// =========================================================================

export const InspeccionesComparacion = () => {
  const contexto = useContext(AppContext);
  const { inspecciones } = useInspecciones();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  // Filtro heredado de la presentación: el año elegido es el que se compara y
  // el año base pasa a ser el inmediato anterior.
  const filtroPres = useFiltroPresentacion();
  const anoPres = parseInt(oPorDefecto(filtroPres?.ano, String(anoActual)), 10) || anoActual;

  const [taller, setTaller] = useState<string>(oPorDefecto(filtroPres?.taller, ''));
  const [ano1, setAno1] = useState<string>(String(anoPres - 1)); // año base
  const [ano2, setAno2] = useState<string>(String(anoPres));     // año a comparar

  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');
  const tallerObj = useMemo(() => talleres.find(t => t.nombre === tallerSeleccionado) || null, [talleres, tallerSeleccionado]);
  const tallerColor = (tallerObj && (tallerObj as any).color) ? (tallerObj as any).color : '#1d8cf8';

  // Años disponibles para el taller (más el actual y el anterior como opciones mínimas)
  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.filter(i => i.taller === tallerSeleccionado).map(i => String(i.ano)));
    set.add(String(anoActual));
    set.add(String(anoActual - 1));
    return Array.from(set).sort();
  }, [inspecciones, tallerSeleccionado, anoActual]);

  // Cantidad de inspecciones de un mes concreto (null si no hay registro)
  const cantidadDe = (anoStr: string, mes: string): number | null => {
    const reg = inspecciones.find(i => i.taller === tallerSeleccionado && String(i.ano) === anoStr && i.mes === mes);
    return reg ? reg.cantidad : null;
  };

  // Columnas: una por mes, con valores de ambos años y su diferencia
  const columnas = useMemo(() => {
    return MESES.map(mes => {
      const v1 = cantidadDe(ano1, mes);
      const v2 = cantidadDe(ano2, mes);
      let dif: number | null = null;
      if (v1 !== null && v2 !== null) dif = v2 - v1;
      return { mes, v1, v2, dif };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspecciones, tallerSeleccionado, ano1, ano2]);

  const totales = useMemo(() => {
    const meses1 = columnas.filter(c => c.v1 !== null);
    const meses2 = columnas.filter(c => c.v2 !== null);
    const total1 = meses1.reduce((a, c) => a + (c.v1 as number), 0);
    const total2 = meses2.reduce((a, c) => a + (c.v2 as number), 0);
    // La diferencia total se calcula solo sobre meses comparables (con datos en ambos años)
    const comparables = columnas.filter(c => c.dif !== null);
    const difTotal = comparables.length > 0 ? comparables.reduce((a, c) => a + (c.dif as number), 0) : null;
    return { total1, total2, difTotal, hay1: meses1.length > 0, hay2: meses2.length > 0, comparables: comparables.length };
  }, [columnas]);

  const hayDatos = totales.hay1 || totales.hay2;

  // Texto y color de una diferencia, con el formato del Excel de referencia
  const textoDif = (dif: number | null) => {
    if (dif === null) return { texto: '—', color: 'var(--text-muted)', icono: null as any };
    if (dif > 0) return { texto: `${dif} CRECIMIENTO`, color: 'var(--success)', icono: <TrendingUp size={13} /> };
    if (dif < 0) return { texto: `${Math.abs(dif)} MENOS`, color: 'var(--danger)', icono: <TrendingDown size={13} /> };
    return { texto: 'NO CRECIMIENTO', color: 'var(--text-muted)', icono: <Minus size={13} /> };
  };

  const difTotalInfo = textoDif(totales.difTotal);

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <GitCompare size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Comparación de Inspecciones</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Año contra año, mes a mes</p>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Taller</label>
          <select value={tallerSeleccionado} onChange={(e) => setTaller(e.target.value)}>
            {talleresOrdenados.length === 0 && <option value="">Sin talleres</option>}
            {talleresOrdenados.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Año base</label>
          <select value={ano1} onChange={(e) => setAno1(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Año a comparar</label>
          <select value={ano2} onChange={(e) => setAno2(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {!hayDatos ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin inspecciones registradas</h3>
          <p style={{ color: 'var(--text-muted)' }}>No hay datos de {tallerSeleccionado || 'este taller'} en {ano1} ni {ano2}.</p>
        </div>
      ) : (
        <>
          {/* KPIs RÁPIDOS */}
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="kpi-card">
              <div className="kpi-title">Total {ano1} <Sigma size={16} color="var(--text-muted)" /></div>
              <div className="kpi-value">{totales.hay1 ? totales.total1 : '—'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Total {ano2} <Sigma size={16} color="var(--primary)" /></div>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>{totales.hay2 ? totales.total2 : '—'}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Diferencia (meses comparables)</div>
              <div className="kpi-value" style={{ color: difTotalInfo.color, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem' }}>
                {difTotalInfo.icono} {difTotalInfo.texto}
              </div>
            </div>
          </div>

          {/* TABLA COMPARATIVA (estructura del Excel de referencia) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
            <div className="report-header" style={{ borderTop: `3px solid ${tallerColor}` }}>
              {tallerSeleccionado} &nbsp;·&nbsp; {ano1} VS {ano2}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '980px' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-body)', zIndex: 2, minWidth: '230px' }}>Inspecciones</th>
                    {MESES.map(m => (
                      <th key={`h-${m}`} style={{ textAlign: 'center', fontSize: '0.7rem' }} title={m}>{m.substring(0, 3)}</th>
                    ))}
                    <th style={{ textAlign: 'center', backgroundColor: 'var(--bg-highlight)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* FILA AÑO BASE */}
                  <tr>
                    <td style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-panel)', zIndex: 1, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--text-muted)', marginRight: '8px' }} />
                      {tallerSeleccionado} — {ano1}
                    </td>
                    {columnas.map(c => (
                      <td key={`a1-${c.mes}`} style={{ textAlign: 'center', fontWeight: 700, color: c.v1 === null ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        {c.v1 === null ? '—' : c.v1}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, backgroundColor: 'var(--bg-highlight)' }}>{totales.hay1 ? totales.total1 : '—'}</td>
                  </tr>

                  {/* FILA AÑO A COMPARAR */}
                  <tr>
                    <td style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-panel)', zIndex: 1, fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: tallerColor, marginRight: '8px' }} />
                      {tallerSeleccionado} — {ano2}
                    </td>
                    {columnas.map(c => (
                      <td key={`a2-${c.mes}`} style={{ textAlign: 'center', fontWeight: 700, color: c.v2 === null ? 'var(--text-muted)' : 'var(--primary)' }}>
                        {c.v2 === null ? '—' : c.v2}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--bg-highlight)' }}>{totales.hay2 ? totales.total2 : '—'}</td>
                  </tr>

                  {/* FILA DIFERENCIA */}
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ position: 'sticky', left: 0, backgroundColor: 'var(--bg-highlight)', zIndex: 1, fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Diferencia
                    </td>
                    {columnas.map(c => {
                      const info = textoDif(c.dif);
                      return (
                        <td key={`dif-${c.mes}`} style={{ textAlign: 'center', padding: '0.6rem 0.4rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', fontWeight: 800, color: info.color, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                            {info.icono} {info.texto}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', padding: '0.6rem 0.4rem', backgroundColor: 'var(--bg-highlight)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 800, color: difTotalInfo.color, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                        {difTotalInfo.icono} {difTotalInfo.texto}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0, padding: '0.75rem 1.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              La diferencia se calcula solo en los meses con datos en ambos años ({totales.comparables} {totales.comparables === 1 ? 'mes comparable' : 'meses comparables'}). "MENOS" = bajó respecto a {ano1}; "CRECIMIENTO" = subió; "NO CRECIMIENTO" = igual.
            </p>
          </div>
        </>
      )}
    </div>
  );
};