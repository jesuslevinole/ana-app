import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useMetasAnuales } from '../hooks/useMetasAnuales';
import { FileBarChart, Filter, TrendingUp, TrendingDown, Target, CheckCircle2, AlertCircle } from 'lucide-react';

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

const colorPorAvance = (pct: number) =>
  pct >= 100 ? '#22c55e' : pct >= 70 ? '#22c55e' : pct >= 40 ? '#ffbc11' : '#ef4444';

export const ReporteAnualGeneral = () => {
  const contexto = useContext(AppContext);
  const { obtenerMetaAnual } = useMetasAnuales();
  if (!contexto) return null;
  const { registros, talleres } = contexto;

  const anoActual = String(new Date().getFullYear());
  const [ano, setAno] = useState<string>(anoActual);

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => r.ano.toString()));
    set.add(anoActual);
    return Array.from(set).sort();
  }, [registros, anoActual]);

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
        return {
          nombre: t.nombre,
          color: (t as any).color || '#1d8cf8',
          meta, logrado, faltante, pct, metaEstablecida,
          mesesRegistrados: regs.length,
          tieneDatos: regs.length > 0
        };
      })
      .filter(x => x.tieneDatos);
  }, [talleresOrdenados, registros, ano, obtenerMetaAnual]);

  // --- TOTALES DEL AÑO ---
  const totales = useMemo(() => {
    const meta = porTaller.reduce((a, t) => a + t.meta, 0);
    const logrado = porTaller.reduce((a, t) => a + t.logrado, 0);
    const faltante = Math.max(meta - logrado, 0);
    const pct = meta > 0 ? (logrado / meta) * 100 : 0;
    return { meta, logrado, faltante, pct };
  }, [porTaller]);

  // --- DESGLOSE MES A MES (consolidado de todos los talleres) ---
  const porMes = useMemo(() => {
    return MESES.map(mes => {
      const regs = registros.filter(r => r.ano.toString() === ano && r.mes === mes);
      const meta = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
      const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
      const dif = logrado - meta;
      const pct = meta > 0 ? (logrado / meta) * 100 : 0;
      return { mes, meta, logrado, dif, pct, tieneDatos: regs.length > 0 };
    });
  }, [registros, ano]);

  const hayDatos = porTaller.length > 0;

  // ---------------------------------------------------------------------
  //  GRÁFICA DE RELOJ (GAUGE): alcanzado en verde, faltante en rojo
  // ---------------------------------------------------------------------
  const renderGauge = (pctCrudo: number) => {
    const pct = Math.max(0, Math.min(pctCrudo, 100)); // la aguja no pasa del 100%
    const W = 420, H = 300;
    const cx = W / 2, cy = 214;
    const rExt = 160, rInt = 112;

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
    const puntaAguja = punto(anguloAguja, rExt - 8);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="420" height="300" style={{ display: 'block', maxWidth: '100%' }}>
        {/* TRAMO ALCANZADO (verde) */}
        {pct > 0 && <path d={sector(0, pct)} fill="#16a34a" style={{ fill: '#16a34a' }} />}
        {/* TRAMO FALTANTE (rojo) */}
        {pct < 100 && <path d={sector(pct, 100)} fill="#dc2626" style={{ fill: '#dc2626' }} />}

        {Array.from({ length: 21 }).map((_, i) => {
          const p = i * 5;
          const ang = 180 - (p / 100) * 180;
          const esMayor = p % 25 === 0;
          const a = punto(ang, rExt - 4);
          const b = punto(ang, esMayor ? rInt + 4 : rExt - 17);
          return (
            <line key={`tick-${p}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#ffffff"
              strokeOpacity={esMayor ? 0.9 : 0.45}
              strokeWidth={esMayor ? 3 : 1.4} />
          );
        })}

        <text x={cx - rExt - 4} y={cy + 20} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">0%</text>
        <text x={cx} y={cy - rExt - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">50%</text>
        <text x={cx + rExt + 4} y={cy + 20} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">100%</text>

        <line x1={cx} y1={cy} x2={puntaAguja.x} y2={puntaAguja.y} stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="15" fill="var(--bg-panel)" stroke="#f1f5f9" strokeWidth="5" />

        {/* PORCENTAJE: debajo de la aguja, en blanco */}
        <text x={cx} y={cy + 58} textAnchor="middle" fontSize="42" fontWeight="900" fill="#ffffff">{pctCrudo.toFixed(2)}%</text>
        <text x={cx} y={cy + 78} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text-muted)" letterSpacing="1.5">ALCANCE ACTUAL</text>
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
          <p style={{ color: 'var(--text-muted)' }}>No hay registros de ventas capturados en este año.</p>
        </div>
      ) : (
        <>
          {/* RESUMEN GENERAL DEL AÑO */}
          <div className="card" style={{ borderTop: '3px solid #ffbc11' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>
                Resumen General {ano} &nbsp;·&nbsp; Todos los talleres
              </h3>
            </div>

            {/* TRES TARJETAS: META (azul) · ALCANZADA (verde) · FALTANTE (rojo) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #1d8cf8', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#1d8cf8', color: '#ffffff', flexShrink: 0, boxShadow: '0 3px 10px #1d8cf855' }}>
                  <Target size={22} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>Meta anual</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d8cf8', whiteSpace: 'nowrap' }}>
                    {miFormatearMoneda(totales.meta)}
                  </div>
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #22c55e', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#22c55e', color: '#ffffff', flexShrink: 0, boxShadow: '0 3px 10px #22c55e55' }}>
                  <CheckCircle2 size={22} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>Meta anual alcanzada</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#22c55e', whiteSpace: 'nowrap' }}>
                    {miFormatearMoneda(totales.logrado)}
                  </div>
                </div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#ffffff', flexShrink: 0, boxShadow: '0 3px 10px #ef444455' }}>
                  <AlertCircle size={22} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>Faltante por alcanzar</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: totales.faltante === 0 ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                    {totales.faltante === 0 ? 'Meta alcanzada ✓' : miFormatearMoneda(totales.faltante)}
                  </div>
                </div>
              </div>
            </div>

            {/* GRÁFICA DE RELOJ: alcanzado en verde, faltante en negro */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffbc11', letterSpacing: '2px' }}>
                  NIVEL ACTUAL DE ALCANCE
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', marginTop: '0.15rem' }}>
                  DESEMPEÑO VS META
                </div>
                <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)', marginTop: '0.6rem' }} />
              </div>

              {renderGauge(totales.pct)}

              <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', backgroundColor: 'var(--bg-body)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(21,128,61,0.18)', border: '2px solid #15803d', flexShrink: 0 }}>
                    <Target size={19} color="#15803d" />
                  </span>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px' }}>ALCANZADO</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>{totales.pct.toFixed(2)}%</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>DEL OBJETIVO</div>
                  </div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.4rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(153,27,27,0.18)', border: '2px solid #991b1b', flexShrink: 0 }}>
                    <TrendingUp size={19} color="#991b1b" />
                  </span>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px' }}>FALTANTE</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b', lineHeight: 1.1 }}>{Math.max(100 - totales.pct, 0).toFixed(2)}%</div>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>PARA LLEGAR AL 100%</div>
                  </div>
                </div>
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
                    <td style={{ textAlign: 'center', padding: '0.9rem' }}>{barra(totales.pct)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>


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