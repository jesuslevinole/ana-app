import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { formatearFecha, formatearMoneda, MESES } from '../utils/formatters';
import { PieChart as PieIcon, Target, TrendingUp, AlertTriangle } from 'lucide-react';

type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas';

export const Dashboard = () => {
  const contexto = useContext(AppContext);
  if (!contexto) return null;
  const { registros, talleres } = contexto;

  // Estados de Filtro
  const [filtroAno, setFiltroAno] = useState<string>('Todos');
  const [filtroMes, setFiltroMes] = useState<string>('Todos');
  const [filtroTaller, setFiltroTaller] = useState<string>('Todos');

  // Estados de Control del Gráfico e Interacción
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('anillo');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  // Listas únicas para selectores
  const anosDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.ano.toString()))).sort(), [registros]);
  
  const talleresDisponibles = useMemo(() => {
    return talleres.map(t => t.nombre).sort();
  }, [talleres]);

  // Buscar el logo del taller seleccionado
  const tallerActivo = useMemo(() => {
    if (filtroTaller === 'Todos') return null;
    return talleres.find(t => t.nombre === filtroTaller) || null;
  }, [filtroTaller, talleres]);

  // Lógica de Filtrado Principal
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      const matchAno = filtroAno === 'Todos' || r.ano.toString() === filtroAno;
      const matchMes = filtroMes === 'Todos' || r.mes === filtroMes;
      const matchTaller = filtroTaller === 'Todos' || r.taller === filtroTaller;
      return matchAno && matchMes && matchTaller;
    });
  }, [registros, filtroAno, filtroMes, filtroTaller]);

  // Cálculos de KPIs Agregados
  const kpis = useMemo(() => {
    const metaTotal = registrosFiltrados.reduce((acc, r) => acc + r.meta, 0);
    const logradoTotal = registrosFiltrados.reduce((acc, r) => acc + r.logrado, 0);
    const faltanteTotal = Math.max(metaTotal - logradoTotal, 0);
    const porcentajeGlobal = metaTotal > 0 ? Math.min(Number(((logradoTotal / metaTotal) * 100).toFixed(2)), 100) : 0;
    return { metaTotal, logradoTotal, faltanteTotal, porcentajeGlobal };
  }, [registrosFiltrados]);

  // Análisis de Operaciones para el Gráfico Principal
  const analisisOperaciones = useMemo(() => {
    const listaOperaciones = registrosFiltrados.flatMap(r => 
      r.detalles.map(d => ({
        ...d,
        tallerPadre: r.taller
      }))
    );

    const totalVendido = listaOperaciones.reduce((acc, op) => acc + op.vendido, 0);
    if (totalVendido === 0) return null;

    const colores = ['#1d8cf8', '#00d6b4', '#ff8d72', '#d048b6', '#ffbc11', '#51cbce', '#8965e0', '#2dce89'];

    let acumuladoGrados = 0;
    
    const operacionesConSectores = listaOperaciones.map((op, index) => {
      const porcentajeOp = (op.vendido / totalVendido) * 100;
      const porcentajeStr = porcentajeOp.toFixed(2);
      const grados = (porcentajeOp / 100) * 360;
      const midAngle = acumuladoGrados + (grados / 2);
      const color = colores[index % colores.length];
      
      const inicio = acumuladoGrados;
      acumuladoGrados += grados;
      const gradientPart = `${color} ${inicio}deg ${acumuladoGrados}deg`;

      return {
        ...op,
        semanaIndex: index + 1,
        porcentajeStr,
        midAngle,
        color,
        gradientPart
      };
    });

    return {
      operaciones: operacionesConSectores,
      gradient: `conic-gradient(${operacionesConSectores.map(o => o.gradientPart).join(', ')})`,
      totalVendido
    };
  }, [registrosFiltrados]);

  // Lógica de Reporte Mensual
  const reporteMensual = useMemo(() => {
    const datosPorMes = MESES.map(mes => {
      const registrosMes = registros.filter(r => {
        const matchAno = filtroAno === 'Todos' || r.ano.toString() === filtroAno;
        const matchTaller = filtroTaller === 'Todos' || r.taller === filtroTaller;
        return r.mes === mes && matchAno && matchTaller;
      });

      const meta = registrosMes.reduce((acc, r) => acc + r.meta, 0);
      const ventas = registrosMes.reduce((acc, r) => acc + r.logrado, 0);
      const porCumplir = Math.max(meta - ventas, 0);
      
      const pctVentas = meta > 0 ? (ventas / meta) * 100 : 0;
      const pctPorCumplir = meta > 0 ? (porCumplir / meta) * 100 : 0;

      return { mes, meta, ventas, pctVentas, porCumplir, pctPorCumplir };
    });

    const totales = {
      meta: datosPorMes.reduce((acc, m) => acc + m.meta, 0),
      ventas: datosPorMes.reduce((acc, m) => acc + m.ventas, 0),
      porCumplir: 0
    };
    totales.porCumplir = Math.max(totales.meta - totales.ventas, 0);

    return { datosPorMes, totales };
  }, [registros, filtroAno, filtroTaller]);

  // --- MOTOR RENDERIZADOR DINÁMICO DE GRÁFICOS ---
  const renderGrafico = () => {
    if (!analisisOperaciones) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos para graficar.</p>;

    const { operaciones, gradient } = analisisOperaciones;
    const maxVendido = Math.max(...operaciones.map(o => o.vendido));

    if (tipoGrafico === 'torta' || tipoGrafico === 'anillo') {
      const isDonut = tipoGrafico === 'anillo';
      const mascaraDonut = isDonut ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';

      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: is3D ? '1rem auto 3.5rem auto' : '2rem 0 3rem 0', width: '100%', height: '260px' }}>
          {is3D ? (
            <div className="pie-chart-wrapper" style={{ margin: 0 }}>
              <div className="pie-chart-3d" style={{ width: '250px', height: '250px', position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(15deg)', transition: 'transform 0.6s' }}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: gradient,
                      transform: `translateZ(-${i}px)`,
                      WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut,
                      filter: i > 0 ? 'brightness(0.65) contrast(1.2)' : 'none',
                      opacity: hoveredOp ? 0.8 : 1
                    } as React.CSSProperties}
                  >
                    {i === 24 && <div className="pie-shadow" style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(20px)', transform: 'translateZ(-5px)' }}></div>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ width: '240px', height: '240px', borderRadius: '50%', background: gradient, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.5s' } as React.CSSProperties} />
          )}

          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 100 }}>
            {operaciones.map(op => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              const radioBase = is3D ? 160 : 145;
              const rawX = Math.cos(rad) * radioBase;
              const rawY = Math.sin(rad) * radioBase;
              let finalX = rawX;
              let finalY = rawY;

              if (is3D) {
                const ySquashed = rawY * 0.5;
                const angle15 = 15 * (Math.PI / 180);
                finalX = rawX * Math.cos(angle15) - ySquashed * Math.sin(angle15);
                finalY = rawX * Math.sin(angle15) + ySquashed * Math.cos(angle15) + 15;
              }

              const isHovered = hoveredOp === op.id;
              const isDimmed = hoveredOp !== null && !isHovered;

              return (
                <div key={`hablador-${op.id}`} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                  style={{
                    position: 'absolute', left: `${finalX}px`, top: `${finalY}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`,
                    backgroundColor: 'var(--bg-panel)', border: `1px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px',
                    boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100,
                    opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatearMoneda(op.vendido)}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (tipoGrafico === 'barras') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(20deg) rotateY(-10deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          {operaciones.map((op) => {
            const altura = maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0;
            const isHovered = hoveredOp === op.id;
            const isDimmed = hoveredOp !== null && !isHovered;

            return (
              <div key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                style={{
                  width: `${Math.max(15, 60 / operaciones.length)}%`, height: `${altura}%`, backgroundColor: op.color, position: 'relative',
                  borderRadius: is3D ? '2px' : '4px 4px 0 0', boxShadow: is3D ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none',
                  backgroundImage: is3D ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none',
                  opacity: isDimmed ? 0.3 : 1, transform: isHovered ? 'translateY(-5px)' : 'none', transition: 'all 0.3s ease', cursor: 'pointer'
              }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{formatearMoneda(op.vendido)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (tipoGrafico === 'lineas') {
      const puntosLinea = operaciones.map((op, i) => {
        const x = (i / Math.max(1, operaciones.length - 1)) * 100;
        const y = 100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0);
        return `${x},${y}`;
      }).join(' ');

      return (
        <div style={{ height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(30deg) rotateY(-15deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', position: 'absolute', inset: 0 }}>
            {is3D && <filter id="shadow"><feDropShadow dx="0" dy="15" stdDeviation="5" floodColor="rgba(0,0,0,0.7)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3D ? "url(#shadow)" : "none"} vectorEffect="non-scaling-stroke" />
          </svg>
          
          {operaciones.map((op, i) => {
            const x = (i / Math.max(1, operaciones.length - 1)) * 100;
            const y = 100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0);
            const isHovered = hoveredOp === op.id;
            const isDimmed = hoveredOp !== null && !isHovered;

            return (
              <div key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                style={{
                  position: 'absolute', left: `${x}%`, top: `${y}%`, width: '14px', height: '14px', backgroundColor: op.color, borderRadius: '50%',
                  transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.5)' : 'scale(1)'}`, border: '2px solid var(--bg-panel)',
                  boxShadow: is3D ? '0 4px 6px rgba(0,0,0,0.5)' : 'none', zIndex: isHovered ? 20 : 10, opacity: isDimmed ? 0.3 : 1, transition: 'all 0.3s ease', cursor: 'pointer'
              }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isHovered ? 1 : (isDimmed ? 0 : 1), transition: 'opacity 0.2s' }}>
                   <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{formatearMoneda(op.vendido)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
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
          {tallerActivo && tallerActivo.logo ? (
            <div style={{ 
              width: '42px', height: '42px', borderRadius: '8px', overflow: 'hidden', 
              border: '2px solid var(--border)', backgroundColor: 'var(--bg-body)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <img src={tallerActivo.logo} alt={tallerActivo.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <PieIcon size={24} color="var(--primary)" />
          )}
          
          <div>
            <h2>Executive Dashboard {tallerActivo ? `- ${tallerActivo.nombre}` : ''}</h2>
            <p className="page-subtitle">Visualización Dinámica e Inteligencia de Datos</p>
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label>Año</label>
          <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
            <option value="Todos">Todos los años</option>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Mes</label>
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="Todos">Todos los meses</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Taller</label>
          <select value={filtroTaller} onChange={(e) => setFiltroTaller(e.target.value)}>
            <option value="Todos">Todos los talleres</option>
            {talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card meta"><div className="kpi-title">Meta Total <Target size={16} /></div><div className="kpi-value">{formatearMoneda(kpis.metaTotal)}</div></div>
        <div className="kpi-card logrado"><div className="kpi-title">Logrado <TrendingUp size={16} color="var(--primary)" /></div><div className="kpi-value" style={{ color: 'var(--primary)' }}>{formatearMoneda(kpis.logradoTotal)}</div></div>
        <div className="kpi-card faltante"><div className="kpi-title">Faltante <AlertTriangle size={16} color="var(--danger)" /></div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatearMoneda(kpis.faltanteTotal)}</div></div>
        <div className="kpi-card">
          <div className="circular-progress-container">
            <div><div className="kpi-title">Cumplido</div><div className="kpi-subtitle">Total</div></div>
            <div className="circular-progress" style={{ background: `conic-gradient(${kpis.porcentajeGlobal >= 100 ? 'var(--success)' : 'var(--primary)'} ${kpis.porcentajeGlobal * 3.6}deg, var(--bg-body) 0deg)` }}><span className="circular-progress-value">{kpis.porcentajeGlobal.toFixed(2)}%</span></div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid-custom">
        <div className="card" style={{ marginBottom: 0 }}>
          <h3 className="detail-section-title">Progreso de la Meta (Operaciones #)</h3>
          <div className="table-wrapper" style={{ boxShadow: 'none', border: 'none', background: 'transparent', marginTop: '1rem' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}># Ref</th>
                  <th>Desde / Hasta</th>
                  <th style={{ textAlign: 'right' }}>Venta</th>
                  <th style={{ textAlign: 'center' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {!analisisOperaciones ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros activos.</td></tr>
                ) : (
                  analisisOperaciones.operaciones.map((op) => {
                    const isHovered = hoveredOp === op.id;
                    const isDimmed = hoveredOp !== null && !isHovered;
                    
                    return (
                      <tr 
                        key={op.id}
                        onMouseEnter={() => setHoveredOp(op.id)}
                        onMouseLeave={() => setHoveredOp(null)}
                        style={{
                          backgroundColor: isHovered ? 'var(--bg-highlight)' : 'transparent',
                          opacity: isDimmed ? 0.4 : 1,
                          transition: 'all 0.2s',
                          cursor: 'pointer'
                        }}
                      >
                        <td style={{ textAlign: 'center' }}><span className="op-badge" style={{ backgroundColor: op.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{op.semanaIndex}</span></td>
                        <td>
                          <div style={{fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600}}>{formatearFecha(op.desde)}</div>
                          <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{formatearFecha(op.hasta)}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{formatearMoneda(op.vendido)}</td>
                        <td style={{ textAlign: 'center' }}><span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>{op.porcentajeStr}%</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TIPO DE GRÁFICO:</label>
              <select 
                value={tipoGrafico} 
                onChange={(e) => setTipoGrafico(e.target.value as TipoGrafico)}
                style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="anillo">Anillo (Donut)</option>
                <option value="torta">Torta (Pie)</option>
                <option value="barras">Barras (Bar)</option>
                <option value="lineas">Líneas (Line)</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button
                style={{ padding: '0.4rem 1rem', border: 'none', background: is3D ? 'var(--primary)' : 'transparent', color: is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                onClick={() => setIs3D(true)}
              >3D</button>
              <button
                style={{ padding: '0.4rem 1rem', border: 'none', background: !is3D ? 'var(--primary)' : 'transparent', color: !is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                onClick={() => setIs3D(false)}
              >2D</button>
            </div>
          </div>

          {renderGrafico()}

          {analisisOperaciones && (
            <ul className="legend-below-chart-list" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              {analisisOperaciones.operaciones.map((op) => {
                const isHovered = hoveredOp === op.id;
                const isDimmed = hoveredOp !== null && !isHovered;

                return (
                  <li 
                    key={op.id} 
                    onMouseEnter={() => setHoveredOp(op.id)}
                    onMouseLeave={() => setHoveredOp(null)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)',
                      backgroundColor: isHovered ? 'var(--sidebar-hover)' : 'transparent',
                      padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer',
                      opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s'
                    }}
                  >
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: op.color, boxShadow: `0 0 5px ${op.color}`, flexShrink: 0 }}></span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                      <span style={{fontWeight: 500}}>Venta semana {op.semanaIndex}</span>
                      <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                        {op.porcentajeStr}%
                      </strong>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Reporte Mensual Consolidado</h3>
          {filtroAno !== 'Todos' && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Año Fiscal: {filtroAno}</span>}
        </div>
        
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Mes</th>
              <th style={{ textAlign: 'right' }}>Meta</th>
              <th style={{ textAlign: 'right' }}>Ventas</th>
              <th style={{ textAlign: 'center' }}>%</th>
              <th style={{ textAlign: 'right' }}>Por Cumplir</th>
              <th style={{ textAlign: 'center' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {reporteMensual.datosPorMes.map(fila => (
              <tr key={fila.mes}>
                <td><strong>{fila.mes}</strong></td>
                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fila.meta > 0 ? formatearMoneda(fila.meta) : '-'}</td>
                <td style={{ textAlign: 'right', fontWeight: fila.ventas > 0 ? 600 : 400, color: fila.ventas > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{fila.ventas > 0 ? formatearMoneda(fila.ventas) : '-'}</td>
                <td style={{ textAlign: 'center' }}>{fila.meta > 0 && <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>{fila.pctVentas.toFixed(2)}%</span>}</td>
                <td style={{ textAlign: 'right', color: fila.porCumplir > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fila.meta > 0 ? formatearMoneda(fila.porCumplir) : '-'}</td>
                <td style={{ textAlign: 'center' }}>{fila.meta > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fila.pctPorCumplir.toFixed(2)}%</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
              <td style={{ padding: '1rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Total</strong></td>
              <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{formatearMoneda(reporteMensual.totales.meta)}</td>
              <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{formatearMoneda(reporteMensual.totales.ventas)}</td>
              <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: 'var(--primary)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.ventas / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
              <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--danger)' }}>{formatearMoneda(reporteMensual.totales.porCumplir)}</td>
              <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: 'var(--danger)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.porCumplir / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};