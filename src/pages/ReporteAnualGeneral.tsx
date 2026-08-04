import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { useMetasAnuales } from '../hooks/useMetasAnuales';
import { FileBarChart, Filter, TrendingUp, TrendingDown, Target, ClipboardCheck } from 'lucide-react';

// =========================================================================
//  REPORTE ANUAL GENERAL
//  Consolida el año completo de TODOS los talleres en una sola vista:
//    · Resumen del año (meta, alcanzado, faltante y % de alcance)
//    · Desglose por taller, con su gráfica de reloj de avance
//    · Desglose mes a mes del consolidado
//    · Inspecciones del año por taller
//  La meta anual es la suma de las metas mensuales registradas del año, para
//  que coincida siempre con el Reporte Mensual Consolidado del Dashboard.
// =========================================================================

const miFormatearMoneda = (valor: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor || 0).replace('$', '$\u00A0');

const fmtNum = (n: number) => (n || 0).toLocaleString('en-US');

const colorPorAvance = (pct: number) =>
  pct >= 100 ? '#22c55e' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#ffbc11' : '#ef4444';

export const ReporteAnualGeneral = () => {
  const contexto = useContext(AppContext);
  const { inspecciones } = useInspecciones();
  const { obtenerMetaAnual } = useMetasAnuales();
  if (!contexto) return null;
  const { registros, talleres } = contexto;

  const anoActual = String(new Date().getFullYear());
  const [ano, setAno] = useState<string>(anoActual);

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => r.ano.toString()));
    inspecciones.forEach(i => set.add(String(i.ano)));
    set.add(anoActual);
    return Array.from(set).sort();
  }, [registros, inspecciones, anoActual]);

  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  // --- DESGLOSE POR TALLER (ventas del año) ---
  const porTaller = useMemo(() => {
    return talleresOrdenados
      .map(t => {
        const regs = registros.filter(r => r.ano.toString() === ano && r.taller === t.nombre);
        const meta = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
        const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
        const faltante = Math.max(meta - logrado, 0);
        const pct = meta > 0 ? (logrado / meta) * 100 : 0;
        const metaEstablecida = obtenerMetaAnual('ventas', ano, t.nombre);
        // Inspecciones del año para el mismo taller
        const insp = inspecciones.filter(i => i.taller === t.nombre && String(i.ano) === ano);
        const inspCantidad = insp.reduce((acc, i) => acc + (i.cantidad || 0), 0);
        const inspMeta = insp.reduce((acc, i) => acc + (typeof (i as any).meta === 'number' ? (i as any).meta : 0), 0);
        const inspPct = inspMeta > 0 ? (inspCantidad / inspMeta) * 100 : 0;
        return {
          nombre: t.nombre,
          color: (t as any).color || '#1d8cf8',
          meta, logrado, faltante, pct, metaEstablecida,
          inspCantidad, inspMeta, inspPct,
          mesesRegistrados: regs.length,
          tieneDatos: regs.length > 0 || insp.length > 0
        };
      })
      .filter(x => x.tieneDatos);
  }, [talleresOrdenados, registros, inspecciones, ano, obtenerMetaAnual]);

  // --- TOTALES DEL AÑO ---
  const totales = useMemo(() => {
    const meta = porTaller.reduce((a, t) => a + t.meta, 0);
    const logrado = porTaller.reduce((a, t) => a + t.logrado, 0);
    const faltante = Math.max(meta - logrado, 0);
    const pct = meta > 0 ? (logrado / meta) * 100 : 0;
    const inspCantidad = porTaller.reduce((a, t) => a + t.inspCantidad, 0);
    const inspMeta = porTaller.reduce((a, t) => a + t.inspMeta, 0);
    const inspPct = inspMeta > 0 ? (inspCantidad / inspMeta) * 100 : 0;
    return { meta, logrado, faltante, pct, inspCantidad, inspMeta, inspPct };
  }, [porTaller]);

  // --- DESGLOSE MES A MES (consolidado de todos los talleres) ---
  const porMes = useMemo(() => {
    return MESES.map(mes => {
      const regs = registros.filter(r => r.ano.toString() === ano && r.mes === mes);
      const meta = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
      const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
      const dif = logrado - meta;
      const pct = meta > 0 ? (logrado / meta) * 100 : 0;
      const insp = inspecciones.filter(i => String(i.ano) === ano && i.mes === mes);
      const inspCantidad = insp.reduce((acc, i) => acc + (i.cantidad || 0), 0);
      return { mes, meta, logrado, dif, pct, inspCantidad, tieneDatos: regs.length > 0 || insp.length > 0 };
    });
  }, [registros, inspecciones, ano]);

  const hayDatos = porTaller.length > 0;

  // ---------------------------------------------------------------------
  //  GRÁFICA DE RELOJ (GAUGE): alcanzado en verde, faltante en rojo
  // ---------------------------------------------------------------------
  const renderGauge = (pctCrudo: number, ancho = 360, alto = 210) => {
    const pct = Math.max(0, Math.min(pctCrudo, 100)); // la aguja no pasa del 100%
    const W = 360, H = 210;
    const cx = W / 2, cy = 178;
    const rExt = 140, rInt = 96;

    const punto = (angGrados: number, radio: number) => {
      const rad = (angGrados * Math.PI) / 180;
      return { x: cx + radio * Math.cos(rad), y: cy - radio * Math.sin(rad) };
    };

    const sector = (pctIni: number, pctFin: number) => {
      const a1 = 180 - (pctIni / 100) * 180;
      const a2 = 180 - (pctFin / 100) * 180;
      const p1 = punto(a1, rExt), p2 = punto(a2, rExt);
      const p3 = punto(a2, rInt), p4 = punto(a1, rInt);
      const largo = Math.abs(a1 - a2) > 180 ? 1 : 0;
      return `M ${p1.x} ${p1.y} A ${rExt} ${rExt} 0 ${largo} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInt} ${rInt} 0 ${largo} 0 ${p4.x} ${p4.y} Z`;
    };

    const anguloAguja = 180 - (pct / 100) * 180;
    const puntaAguja = punto(anguloAguja, rExt - 16);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={ancho} height={alto} style={{ display: 'block', maxWidth: '100%' }}>
        {pct > 0 && <path d={sector(0, pct)} fill="#22c55e" />}
        {pct < 100 && <path d={sector(pct, 100)} fill="#ef4444" fillOpacity="0.85" />}

        {Array.from({ length: 21 }).map((_, i) => {
          const p = i * 5;
          const ang = 180 - (p / 100) * 180;
          const esMayor = p % 25 === 0;
          const a = punto(ang, rExt - 3);
          const b = punto(ang, esMayor ? rInt + 3 : rExt - 14);
          return <line key={`tick-${p}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={esMayor ? 0.85 : 0.4} strokeWidth={esMayor ? 2.5 : 1.2} />;
        })}

        <text x={cx - rExt - 2} y={cy + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-muted)">0%</text>
        <text x={cx} y={cy - rExt - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-muted)">50%</text>
        <text x={cx + rExt + 2} y={cy + 20} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-muted)">100%</text>

        <line x1={cx} y1={cy} x2={puntaAguja.x} y2={puntaAguja.y} stroke="var(--text-main)" strokeWidth="5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="13" fill="var(--bg-panel)" stroke="var(--text-main)" strokeWidth="4" />

        <text x={cx} y={cy - 34} textAnchor="middle" fontSize="38" fontWeight="900" fill={colorPorAvance(pctCrudo)}>{pctCrudo.toFixed(2)}%</text>
      </svg>
    );
  };

  // Barra de avance compacta para las tablas
  const barra = (pct: number) => {
    const c = colorPorAvance(pct);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
        <div style={{ flex: 1, height: '10px', backgroundColor: 'var(--bg-highlight)', borderRadius: '5px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: '5px', background: `linear-gradient(90deg, ${c}bb 0%, ${c} 100%)`, transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }} />
        </div>
        <span style={{ fontWeight: 900, color: c, whiteSpace: 'nowrap', fontSize: '0.85rem', minWidth: '64px', textAlign: 'right' }}>{pct.toFixed(2)}%</span>
      </div>
    );
  };

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FileBarChart size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Reporte Anual General</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Consolidado del año de todos los talleres</p>
          </div>
        </div>
      </div>

      {/* FILTRO */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Año</label>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {!hayDatos ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin datos para {ano}</h3>
          <p style={{ color: 'var(--text-muted)' }}>No hay registros de ventas ni inspecciones capturados en este año.</p>
        </div>
      ) : (
        <>
          {/* RESUMEN GENERAL DEL AÑO */}
          <div className="card" style={{ borderTop: '3px solid #ffbc11' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>
                Resumen General {ano} &nbsp;·&nbsp; Todos los talleres
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Suma de las metas mensuales del año</span>
            </div>

            {/* TRES TARJETAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #ffbc11' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.35rem' }}>Meta anual</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffbc11', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.meta)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #22c55e' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.35rem' }}>Meta anual alcanzada</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.logrado)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #ef4444' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.35rem' }}>Faltante por alcanzar</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totales.faltante === 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                  {totales.faltante === 0 ? 'Meta alcanzada ✓' : miFormatearMoneda(totales.faltante)}
                </div>
              </div>
            </div>

            {/* GRÁFICA DE RELOJ */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem' }}>
              {renderGauge(totales.pct)}
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', marginTop: '0.35rem' }}>
                Nivel actual de alcance
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.9rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  <span style={{ width: '13px', height: '13px', borderRadius: '3px', backgroundColor: '#22c55e', display: 'inline-block' }} />
                  Alcanzado {totales.pct.toFixed(2)}%
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  <span style={{ width: '13px', height: '13px', borderRadius: '3px', backgroundColor: '#ef4444', display: 'inline-block' }} />
                  Faltante {Math.max(100 - totales.pct, 0).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* DESGLOSE POR TALLER */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
            <div className="report-header" style={{ borderTop: '3px solid var(--primary)' }}>
              VENTAS POR TALLER &nbsp;·&nbsp; AÑO {ano}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '860px' }}>
                <thead>
                  <tr>
                    <th>Taller</th>
                    <th style={{ textAlign: 'center' }}>Meses</th>
                    <th style={{ textAlign: 'right' }}>Meta anual</th>
                    <th style={{ textAlign: 'right' }}>Alcanzado</th>
                    <th style={{ textAlign: 'right' }}>Faltante</th>
                    <th style={{ textAlign: 'center', minWidth: '210px' }}>Porcentaje de meta alcanzada</th>
                  </tr>
                </thead>
                <tbody>
                  {porTaller.map(t => (
                    <tr key={`vt-${t.nombre}`}>
                      <td>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: t.color, marginRight: '8px' }} />
                        <strong style={{ color: 'var(--text-main)' }}>{t.nombre}</strong>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>{t.mesesRegistrados}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#ffbc11', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.meta)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.logrado)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: t.faltante === 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                        {t.faltante === 0 ? 'Alcanzada ✓' : miFormatearMoneda(t.faltante)}
                      </td>
                      <td style={{ textAlign: 'center' }}>{barra(t.pct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.9rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Total todos los talleres</strong></td>
                    <td style={{ textAlign: 'center' }} />
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: '#ffbc11', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.meta)}</td>
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.logrado)}</td>
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: totales.faltante === 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                      {totales.faltante === 0 ? 'Alcanzada ✓' : miFormatearMoneda(totales.faltante)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.9rem' }}>{barra(totales.pct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* DESGLOSE MES A MES */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
            <div className="report-header" style={{ borderTop: '3px solid #ffbc11' }}>
              CONSOLIDADO MES A MES &nbsp;·&nbsp; AÑO {ano}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '820px' }}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th style={{ textAlign: 'right' }}>Meta</th>
                    <th style={{ textAlign: 'right' }}>Ventas</th>
                    <th style={{ textAlign: 'right' }}>Diferencia</th>
                    <th style={{ textAlign: 'center' }}>Inspecciones</th>
                    <th style={{ textAlign: 'center', minWidth: '200px' }}>% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {porMes.map(m => (
                    <tr key={`pm-${m.mes}`} style={!m.tieneDatos ? { opacity: 0.45 } : undefined}>
                      <td><strong style={{ color: 'var(--text-main)' }}>{m.mes}</strong></td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.meta > 0 ? miFormatearMoneda(m.meta) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' }}>{m.logrado > 0 ? miFormatearMoneda(m.logrado) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: !m.tieneDatos || m.meta === 0 ? 'var(--text-muted)' : m.dif >= 0 ? '#22c55e' : '#ef4444' }}>
                        {!m.tieneDatos || m.meta === 0 ? '—' : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                            {m.dif >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {m.dif >= 0 ? '+' : '-'}{miFormatearMoneda(Math.abs(m.dif))}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)' }}>{m.inspCantidad > 0 ? fmtNum(m.inspCantidad) : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{m.meta > 0 ? barra(m.pct) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.9rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Total {ano}</strong></td>
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: '#ffbc11', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.meta)}</td>
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.logrado)}</td>
                    <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, whiteSpace: 'nowrap', color: totales.logrado - totales.meta >= 0 ? '#22c55e' : '#ef4444' }}>
                      {totales.logrado - totales.meta >= 0 ? '+' : '-'}{miFormatearMoneda(Math.abs(totales.logrado - totales.meta))}
                    </td>
                    <td style={{ textAlign: 'center', padding: '0.9rem', fontWeight: 900, color: 'var(--primary)' }}>{fmtNum(totales.inspCantidad)}</td>
                    <td style={{ textAlign: 'center', padding: '0.9rem' }}>{barra(totales.pct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* INSPECCIONES DEL AÑO */}
          {totales.inspCantidad > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
              <div className="report-header" style={{ borderTop: '3px solid #7c3aed' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ClipboardCheck size={16} /> INSPECCIONES POR TALLER &nbsp;·&nbsp; AÑO {ano}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', minWidth: '700px' }}>
                  <thead>
                    <tr>
                      <th>Taller</th>
                      <th style={{ textAlign: 'right' }}>Meta anual</th>
                      <th style={{ textAlign: 'right' }}>Realizadas</th>
                      <th style={{ textAlign: 'center', minWidth: '210px' }}>% Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porTaller.filter(t => t.inspCantidad > 0 || t.inspMeta > 0).map(t => (
                      <tr key={`it-${t.nombre}`}>
                        <td>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: t.color, marginRight: '8px' }} />
                          <strong style={{ color: 'var(--text-main)' }}>{t.nombre}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ffbc11' }}>{t.inspMeta > 0 ? fmtNum(t.inspMeta) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>{fmtNum(t.inspCantidad)}</td>
                        <td style={{ textAlign: 'center' }}>{t.inspMeta > 0 ? barra(t.inspPct) : <span style={{ color: 'var(--text-muted)' }}>Sin meta</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '0.9rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Total todos los talleres</strong></td>
                      <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: '#ffbc11' }}>{totales.inspMeta > 0 ? fmtNum(totales.inspMeta) : '—'}</td>
                      <td style={{ textAlign: 'right', padding: '0.9rem', fontWeight: 900, color: 'var(--primary)' }}>{fmtNum(totales.inspCantidad)}</td>
                      <td style={{ textAlign: 'center', padding: '0.9rem' }}>
                        {totales.inspMeta > 0 ? barra(totales.inspPct) : <span style={{ color: 'var(--text-muted)' }}>Sin meta</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* NOTA */}
          <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            <Target size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            La meta anual es la suma de las metas mensuales registradas del año, por lo que coincide con el Reporte Mensual Consolidado del Dashboard.
          </p>
        </>
      )}
    </div>
  );
};