import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearMoneda } from '../utils/formatters';
import { GitCompare, TrendingUp, TrendingDown } from 'lucide-react';

const TRIMESTRES = {
  'Q1': ['Enero', 'Febrero', 'Marzo'],
  'Q2': ['Abril', 'Mayo', 'Junio'],
  'Q3': ['Julio', 'Agosto', 'Septiembre'],
  'Q4': ['Octubre', 'Noviembre', 'Diciembre']
};

type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas';

export const Comparacion = () => {
  const contexto = useContext(AppContext);
  if (!contexto) return null;
  const { registros } = contexto;

  const currentYear = new Date().getFullYear().toString();
  
  const anosDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.ano.toString()))).sort(), [registros]);
  const talleresDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.taller))).sort(), [registros]);

  // Filtros
  const [taller, setTaller] = useState<string>(talleresDisponibles[0] || 'Todos');
  const [ano1, setAno1] = useState<string>(currentYear);
  const [trimestre1, setTrimestre1] = useState<keyof typeof TRIMESTRES>('Q1');
  const [ano2, setAno2] = useState<string>(currentYear);
  const [trimestre2, setTrimestre2] = useState<keyof typeof TRIMESTRES>('Q2');

  // Controles Columna 1 (Izquierda)
  const [tipoGrafico1, setTipoGrafico1] = useState<TipoGrafico>('barras');
  const [is3D1, setIs3D1] = useState<boolean>(true);
  const [hoveredId1, setHoveredId1] = useState<string | null>(null);

  // Controles Columna 2 (Derecha)
  const [tipoGrafico2, setTipoGrafico2] = useState<TipoGrafico>('barras');
  const [is3D2, setIs3D2] = useState<boolean>(true);
  const [hoveredId2, setHoveredId2] = useState<string | null>(null);

  // Extracción de datos abstracta
  const generarDatosTrimestre = (ano: string, trimestre: keyof typeof TRIMESTRES) => {
    const meses = TRIMESTRES[trimestre];
    const datosMensuales = meses.map(mes => {
      const ventasMes = registros
        .filter(r => r.ano.toString() === ano && r.mes === mes && (taller === 'Todos' || r.taller === taller))
        .reduce((acc, r) => acc + r.logrado, 0);
      return { mes, ventas: ventasMes };
    });
    const totalVentas = datosMensuales.reduce((acc, d) => acc + d.ventas, 0);
    return { datos: datosMensuales, total: totalVentas, titulo: `${trimestre} DEL AÑO ${ano}` };
  };

  const periodo1 = useMemo(() => generarDatosTrimestre(ano1, trimestre1), [registros, taller, ano1, trimestre1]);
  const periodo2 = useMemo(() => generarDatosTrimestre(ano2, trimestre2), [registros, taller, ano2, trimestre2]);

  // Construcción de Dataset para Gráfico Izquierdo
  const datasetLeft = useMemo(() => {
    const colores = ['#1d8cf8', '#00d6b4', '#ffbc11'];
    return periodo1.datos.map((d, i) => {
      const pct = periodo1.total > 0 ? (d.ventas / periodo1.total) * 100 : 0;
      return { id: `L-${d.mes}`, label: d.mes, ventas: d.ventas, color: colores[i % colores.length], pctStr: pct.toFixed(2) };
    });
  }, [periodo1]);
  const maxVentaMensual = Math.max(...datasetLeft.map(d => d.ventas));

  // Construcción de Dataset para Gráfico Derecho
  const totalAmbosPeriodos = periodo1.total + periodo2.total;
  const pctPeriodo1 = totalAmbosPeriodos > 0 ? (periodo1.total / totalAmbosPeriodos) * 100 : 0;
  const pctPeriodo2 = totalAmbosPeriodos > 0 ? (periodo2.total / totalAmbosPeriodos) * 100 : 0;
  const crecimiento = periodo1.total > 0 ? ((periodo2.total - periodo1.total) / periodo1.total) * 100 : 0;
  
  const datasetRight = useMemo(() => {
    return [
      { id: 'R1', label: `${trimestre1} ${ano1}`, ventas: periodo1.total, color: '#1d8cf8', pctStr: pctPeriodo1.toFixed(2) },
      { id: 'R2', label: `${trimestre2} ${ano2}`, ventas: periodo2.total, color: '#ff8d72', pctStr: pctPeriodo2.toFixed(2) }
    ];
  }, [trimestre1, ano1, periodo1.total, pctPeriodo1, trimestre2, ano2, periodo2.total, pctPeriodo2]);
  const maxTotalComparacion = Math.max(...datasetRight.map(d => d.ventas));

  // ============================================================================
  // MOTOR DE RENDERIZADO DINÁMICO (Reutilizable para ambas columnas)
  // ============================================================================
  const renderDynamicChart = (
    data: typeof datasetLeft, total: number, maxVal: number,
    tipo: TipoGrafico, is3D: boolean,
    hoveredId: string | null, setHoveredId: (id: string | null) => void
  ) => {
    if (total === 0) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos para graficar.</p>;

    // Pre-cálculos para Tortas/Anillos
    let acumuladoGrados = 0;
    const pieData = data.map(d => {
      const pct = total > 0 ? (d.ventas / total) * 100 : 0;
      const grados = (pct / 100) * 360;
      const midAngle = acumuladoGrados + (grados / 2);
      const inicio = acumuladoGrados;
      acumuladoGrados += grados;
      return { ...d, midAngle, gradientPart: `${d.color} ${inicio}deg ${acumuladoGrados}deg` };
    });
    const gradient = `conic-gradient(${pieData.map(d => d.gradientPart).join(', ')})`;

    // 1. TORTA O ANILLO
    if (tipo === 'torta' || tipo === 'anillo') {
      const isDonut = tipo === 'anillo';
      const mascaraDonut = isDonut ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';

      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: is3D ? '1rem auto 3.5rem auto' : '2rem 0 3rem 0', width: '100%', height: '240px' }}>
          {is3D ? (
            <div className="pie-chart-wrapper" style={{ margin: 0, height: '220px', width: '220px' }}>
              <div className="pie-chart-3d" style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(15deg)', transition: 'transform 0.6s' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: gradient, transform: `translateZ(-${i}px)`, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, filter: i > 0 ? 'brightness(0.65) contrast(1.2)' : 'none', opacity: hoveredId ? 0.8 : 1 }}>
                    {i === 19 && <div className="pie-shadow" style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(20px)', transform: 'translateZ(-5px)' }}></div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ width: '220px', height: '220px', borderRadius: '50%', background: gradient, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.5s' }} />
          )}

          {/* Habladores Flotantes */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 100 }}>
            {pieData.map(op => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              const radioBase = is3D ? 140 : 130;
              const rawX = Math.cos(rad) * radioBase;
              const rawY = Math.sin(rad) * radioBase;
              let finalX = rawX;
              let finalY = rawY;

              if (is3D) {
                const ySquashed = rawY * 0.5;
                const angle15 = 15 * (Math.PI / 180);
                finalX = rawX * Math.cos(angle15) - ySquashed * Math.sin(angle15);
                finalY = rawX * Math.sin(angle15) + ySquashed * Math.cos(angle15) + 10;
              }

              const isHovered = hoveredId === op.id;
              const isDimmed = hoveredId !== null && !isHovered;

              return (
                <div key={`hab-${op.id}`} onMouseEnter={() => setHoveredId(op.id)} onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: 'absolute', left: `${finalX}px`, top: `${finalY}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
                    backgroundColor: 'var(--bg-panel)', border: `1px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px',
                    boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100,
                    opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatearMoneda(op.ventas)}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color }}>{op.pctStr}%</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // 2. BARRAS
    if (tipo === 'barras') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(20deg) rotateY(-10deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          {data.map((op) => {
            const altura = maxVal > 0 ? (op.ventas / maxVal) * 85 : 0;
            const isHovered = hoveredId === op.id;
            const isDimmed = hoveredId !== null && !isHovered;
            return (
              <div key={op.id} onMouseEnter={() => setHoveredId(op.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: `${Math.max(15, 60 / data.length)}%`, height: `${altura}%`, backgroundColor: op.color, position: 'relative',
                  borderRadius: is3D ? '2px' : '4px 4px 0 0', boxShadow: is3D ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none',
                  backgroundImage: is3D ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none',
                  opacity: isDimmed ? 0.3 : 1, transform: isHovered ? 'translateY(-5px)' : 'none', transition: 'all 0.3s ease', cursor: 'pointer'
                }}
              >
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{formatearMoneda(op.ventas)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.pctStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 3. LÍNEAS
    if (tipo === 'lineas') {
      const puntosLinea = data.map((op, i) => {
        const x = (i / Math.max(1, data.length - 1)) * 100;
        const y = 100 - (maxVal > 0 ? (op.ventas / maxVal) * 85 : 0);
        return `${x},${y}`;
      }).join(' ');

      return (
        <div style={{ height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(30deg) rotateY(-15deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', position: 'absolute', inset: 0 }}>
            {is3D && <filter id="shadow-cmp"><feDropShadow dx="0" dy="15" stdDeviation="5" floodColor="rgba(0,0,0,0.7)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3D ? "url(#shadow-cmp)" : "none"} vectorEffect="non-scaling-stroke" />
          </svg>
          {data.map((op, i) => {
            const x = (i / Math.max(1, data.length - 1)) * 100;
            const y = 100 - (maxVal > 0 ? (op.ventas / maxVal) * 85 : 0);
            const isHovered = hoveredId === op.id;
            const isDimmed = hoveredId !== null && !isHovered;

            return (
              <div key={op.id} onMouseEnter={() => setHoveredId(op.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'absolute', left: `${x}%`, top: `${y}%`, width: '14px', height: '14px', backgroundColor: op.color, borderRadius: '50%',
                  transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.5)' : 'scale(1)'}`, border: '2px solid var(--bg-panel)',
                  boxShadow: is3D ? '0 4px 6px rgba(0,0,0,0.5)' : 'none', zIndex: isHovered ? 20 : 10, opacity: isDimmed ? 0.3 : 1, transition: 'all 0.3s ease', cursor: 'pointer'
                }}
              >
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isHovered ? 1 : (isDimmed ? 0 : 1), transition: 'opacity 0.2s' }}>
                   <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatearMoneda(op.ventas)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.pctStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title">
          <GitCompare size={24} color="var(--primary)" />
          <div>
            <h2>Análisis Comparativo</h2>
            <p className="page-subtitle">Rendimiento paralelo y crecimiento</p>
          </div>
        </div>
      </div>

      {/* CONTROLES DE FILTRO GLOBALES */}
      <div className="filter-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
        <div className="filter-group">
          <label>Taller a Evaluar</label>
          <select value={taller} onChange={(e) => setTaller(e.target.value)}>
            <option value="Todos">Consolidado Global</option>
            {talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        
        <div className="filter-group" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
          <label style={{ color: 'var(--primary)' }}>Período Base (T1)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={ano1} onChange={(e) => setAno1(e.target.value)} style={{ flex: 1 }}>{anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}</select>
            <select value={trimestre1} onChange={(e) => setTrimestre1(e.target.value as keyof typeof TRIMESTRES)} style={{ flex: 1 }}>
              <option value="Q1">1er Trimestre</option><option value="Q2">2do Trimestre</option><option value="Q3">3er Trimestre</option><option value="Q4">4to Trimestre</option>
            </select>
          </div>
        </div>

        <div className="filter-group" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
          <label style={{ color: 'var(--danger)' }}>Período a Comparar (T2)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={ano2} onChange={(e) => setAno2(e.target.value)} style={{ flex: 1 }}>{anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}</select>
            <select value={trimestre2} onChange={(e) => setTrimestre2(e.target.value as keyof typeof TRIMESTRES)} style={{ flex: 1 }}>
              <option value="Q1">1er Trimestre</option><option value="Q2">2do Trimestre</option><option value="Q3">3er Trimestre</option><option value="Q4">4to Trimestre</option>
            </select>
          </div>
        </div>
      </div>

      {/* REJILLA PARALELA: LADO A LADO */}
      <div className="comparison-grid">
        
        {/* =========================================================
            COLUMNA IZQUIERDA: DETALLE DEL PERÍODO BASE
            ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="report-header t1">{periodo1.titulo}</div>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Mes / Contexto</th>
                  <th style={{ textAlign: 'right' }}>Ventas</th>
                  <th style={{ textAlign: 'center' }}>% Part.</th>
                </tr>
              </thead>
              <tbody>
                {datasetLeft.map((d) => {
                  const isHovered = hoveredId1 === d.id;
                  const isDimmed = hoveredId1 !== null && !isHovered;
                  return (
                    <tr key={d.id} onMouseEnter={() => setHoveredId1(d.id)} onMouseLeave={() => setHoveredId1(null)}
                      style={{ backgroundColor: isHovered ? 'var(--bg-highlight)' : 'transparent', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: d.color }}></span>
                          <strong style={{ color: 'var(--text-main)' }}>{d.label}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: d.ventas > 0 ? 600 : 400 }}>{d.ventas > 0 ? formatearMoneda(d.ventas) : '-'}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{d.pctStr}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}><strong style={{ fontSize: '1rem' }}>TOTAL {trimestre1}</strong></td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{formatearMoneda(periodo1.total)}</td>
                  <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 700 }}>{periodo1.total > 0 ? '100.00%' : '0.00%'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Gráfico y Controles Izquierdos */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h3 className="detail-section-title" style={{ border: 'none', margin: 0 }}>Desglose {trimestre1}</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select value={tipoGrafico1} onChange={(e) => setTipoGrafico1(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="barras">Barras</option><option value="torta">Torta</option><option value="anillo">Anillo</option><option value="lineas">Líneas</option>
                </select>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: is3D1 ? 'var(--primary)' : 'transparent', color: is3D1 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D1(true)}>3D</button>
                  <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: !is3D1 ? 'var(--primary)' : 'transparent', color: !is3D1 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D1(false)}>2D</button>
                </div>
              </div>
            </div>
            
            {renderDynamicChart(datasetLeft, periodo1.total, maxVentaMensual, tipoGrafico1, is3D1, hoveredId1, setHoveredId1)}

            <ul className="legend-below-chart-list">
              {datasetLeft.map(d => (
                <li key={`leg-${d.id}`} onMouseEnter={() => setHoveredId1(d.id)} onMouseLeave={() => setHoveredId1(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: hoveredId1 === d.id ? 'var(--sidebar-hover)' : 'transparent', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', opacity: hoveredId1 !== null && hoveredId1 !== d.id ? 0.4 : 1, transition: 'all 0.2s' }}>
                  <span className="custom-color-bullet" style={{ backgroundColor: d.color, color: d.color }}></span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                    <span>{d.label}</span>
                    <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.pctStr}%</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* =========================================================
            COLUMNA DERECHA: COMPARACIÓN DE TOTALES (T1 vs T2)
            ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="report-header" style={{ borderTop: '3px solid var(--text-muted)' }}>
              CRECIMIENTO: {ano1} VS {ano2}
            </div>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Período Analizado</th>
                  <th style={{ textAlign: 'right' }}>Ventas Totales</th>
                  <th style={{ textAlign: 'center' }}>% Part.</th>
                </tr>
              </thead>
              <tbody>
                {datasetRight.map(d => {
                  const isHovered = hoveredId2 === d.id;
                  const isDimmed = hoveredId2 !== null && !isHovered;
                  return (
                    <tr key={d.id} onMouseEnter={() => setHoveredId2(d.id)} onMouseLeave={() => setHoveredId2(null)}
                      style={{ backgroundColor: isHovered ? 'var(--bg-highlight)' : 'transparent', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: d.color }}></span>
                          <strong style={{ color: 'var(--text-main)' }}>{d.label}</strong>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.ventas > 0 ? formatearMoneda(d.ventas) : '-'}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{d.pctStr}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '1rem' }}><strong style={{ fontSize: '1rem' }}>TOTAL COMPARADO</strong></td>
                  <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatearMoneda(totalAmbosPeriodos)}</td>
                  <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 700 }}>{totalAmbosPeriodos > 0 ? '100.00%' : '0.00%'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Gráfico y Controles Derechos */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', borderRadius: '20px', fontWeight: 700, fontSize: '0.75rem',
                  backgroundColor: crecimiento >= 0 ? 'rgba(0, 214, 180, 0.15)' : 'rgba(255, 141, 114, 0.15)', color: crecimiento >= 0 ? 'var(--success)' : 'var(--danger)'
                }}>
                  {crecimiento >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {crecimiento > 0 ? '+' : ''}{crecimiento.toFixed(2)}%
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select value={tipoGrafico2} onChange={(e) => setTipoGrafico2(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="barras">Barras</option><option value="torta">Torta</option><option value="anillo">Anillo</option><option value="lineas">Líneas</option>
                </select>
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: is3D2 ? 'var(--primary)' : 'transparent', color: is3D2 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D2(true)}>3D</button>
                  <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: !is3D2 ? 'var(--primary)' : 'transparent', color: !is3D2 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D2(false)}>2D</button>
                </div>
              </div>
            </div>

            {renderDynamicChart(datasetRight, totalAmbosPeriodos, maxTotalComparacion, tipoGrafico2, is3D2, hoveredId2, setHoveredId2)}

            <ul className="legend-below-chart-list">
              {datasetRight.map(d => (
                <li key={`leg-${d.id}`} onMouseEnter={() => setHoveredId2(d.id)} onMouseLeave={() => setHoveredId2(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: hoveredId2 === d.id ? 'var(--sidebar-hover)' : 'transparent', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', opacity: hoveredId2 !== null && hoveredId2 !== d.id ? 0.4 : 1, transition: 'all 0.2s' }}>
                  <span className="custom-color-bullet" style={{ backgroundColor: d.color, color: d.color }}></span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                    <span>{d.label}</span>
                    <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{d.pctStr}%</strong>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};