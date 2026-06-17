import { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { LineChart, TrendingUp, TrendingDown, Award, Sigma, Filter } from 'lucide-react';

type Modo = 'enteros' | 'porcentual';
type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas';

const COLORES = ['#1d8cf8', '#00d6b4', '#ff8d72', '#d048b6', '#ffbc11', '#51cbce', '#8965e0', '#2dce89', '#f56036', '#c72e6b', '#2a86ff', '#e2d849'];

export const InspeccionesDashboard = () => {
  const contexto = useContext(AppContext);
  const { inspecciones } = useInspecciones();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  const [taller, setTaller] = useState<string>('');
  const [ano, setAno] = useState<string>(String(anoActual));
  const [modo, setModo] = useState<Modo>('enteros');

  // Controles de gráfico (como en el Dashboard principal)
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('lineas');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [hovered, setHovered] = useState<string | null>(null);

  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.filter(i => i.taller === tallerSeleccionado).map(i => String(i.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [inspecciones, tallerSeleccionado, anoActual]);

  // Datos del taller/año, en orden calendario, solo meses con registro
  const datos = useMemo(() => {
    return MESES
      .map(mes => {
        const reg = inspecciones.find(i => i.taller === tallerSeleccionado && String(i.ano) === ano && i.mes === mes);
        return reg ? { mes, cantidad: reg.cantidad } : null;
      })
      .filter((d): d is { mes: string; cantidad: number } => d !== null);
  }, [inspecciones, tallerSeleccionado, ano]);

  // Sectores para torta/anillo/barras/leyenda (distribución sobre el total)
  const datosGrafico = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    let acumuladoGrados = 0;
    const arr = datos.map((d, index) => {
      const pct = total > 0 ? (d.cantidad / total) * 100 : 0;
      const grados = (pct / 100) * 360;
      const inicio = acumuladoGrados;
      const midAngle = inicio + grados / 2;
      acumuladoGrados += grados;
      const color = COLORES[index % COLORES.length];
      return { id: d.mes, label: d.mes, cantidad: d.cantidad, pct, porcentajeStr: pct.toFixed(1), midAngle, color, gradientPart: `${color} ${inicio}deg ${acumuladoGrados}deg` };
    });
    return { arr, total, gradient: `conic-gradient(${arr.map(a => a.gradientPart).join(', ')})`, maxCantidad: Math.max(...datos.map(d => d.cantidad), 1) };
  }, [datos]);

  const filas = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    return datos.map((d, i) => {
      const prev = i > 0 ? datos[i - 1].cantidad : null;
      const deltaEntero = prev !== null ? d.cantidad - prev : null;
      const deltaPct = prev !== null && prev > 0 ? ((d.cantidad - prev) / prev) * 100 : null;
      const pctTotal = total > 0 ? (d.cantidad / total) * 100 : 0;
      return { ...d, deltaEntero, deltaPct, pctTotal };
    });
  }, [datos]);

  const kpis = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    const promedio = datos.length > 0 ? total / datos.length : 0;
    const mejor = datos.reduce((best, d) => (d.cantidad > best.cantidad ? d : best), { mes: '-', cantidad: 0 });
    let variacionUltimo: number | null = null;
    if (datos.length >= 2) {
      const a = datos[datos.length - 2].cantidad;
      const b = datos[datos.length - 1].cantidad;
      variacionUltimo = a > 0 ? ((b - a) / a) * 100 : null;
    }
    return { total, promedio, mejor, variacionUltimo };
  }, [datos]);

  // ---- GRÁFICA DE LÍNEAS (SVG contenido, respeta modo enteros/porcentual) ----
  const renderLinea = () => {
    const esPct = modo === 'porcentual';
    const serie = datos.map((d, i) => {
      if (!esPct) return { label: d.mes, valor: d.cantidad };
      const prev = i > 0 ? datos[i - 1].cantidad : 0;
      const varp = i > 0 && prev > 0 ? ((d.cantidad - prev) / prev) * 100 : 0;
      return { label: d.mes, valor: Number(varp.toFixed(1)) };
    });

    const W = 760, H = 320, pl = 54, pr = 26, pt = 42, pb = 42;
    const iw = W - pl - pr, ih = H - pt - pb;
    const vals = serie.map(s => s.valor);
    let min = Math.min(...vals, 0);
    let max = Math.max(...vals, 0);
    if (min === max) max = min + (esPct ? 10 : 5);

    const X = (i: number) => pl + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
    const Y = (v: number) => pt + ih - ((v - min) / (max - min)) * ih;
    const poly = serie.map((s, i) => `${X(i).toFixed(1)},${Y(s.valor).toFixed(1)}`).join(' ');
    const ticks = 4;
    const hayCero = min < 0 && max > 0;

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: '480px', display: 'block' }}>
          {Array.from({ length: ticks + 1 }).map((_, k) => {
            const v = min + (max - min) * (k / ticks);
            const yy = Y(v);
            return (
              <g key={`grid-${k}`}>
                <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="var(--border)" strokeWidth="1" opacity="0.4" />
                <text x={pl - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{esPct ? `${v.toFixed(0)}%` : Math.round(v)}</text>
              </g>
            );
          })}
          {hayCero && <line x1={pl} y1={Y(0)} x2={W - pr} y2={Y(0)} stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />}
          <polyline points={poly} fill="none" stroke="#ff4c4c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {serie.map((s, i) => {
            const cx = X(i), cy = Y(s.valor);
            return (
              <g key={`pt-${i}`}>
                <circle cx={cx} cy={cy} r="6" fill="#ff4c4c" stroke="var(--bg-panel)" strokeWidth="2" />
                <text x={cx} y={cy - 13} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-main)">{esPct ? `${s.valor.toFixed(1)}%` : s.valor}</text>
                <text x={cx} y={H - pb + 20} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text-main)">{s.label.substring(0, 3)}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  // ---- BARRAS (enteros) con etiqueta de mes debajo ----
  const renderBarras = () => {
    const sectores = datosGrafico.arr;
    const maxC = datosGrafico.maxCantidad;
    const anchoCol = `${Math.max(8, 60 / sectores.length)}%`;
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '240px', width: '100%', padding: '1.5rem 1rem 0 1rem', marginTop: '1rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(20deg) rotateY(-10deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          {sectores.map(op => {
            const altura = (op.cantidad / maxC) * 85;
            const isHovered = hovered === op.id;
            const isDimmed = hovered !== null && !isHovered;
            return (
              <div key={op.id} onMouseEnter={() => setHovered(op.id)} onMouseLeave={() => setHovered(null)}
                style={{ width: anchoCol, height: `${altura}%`, backgroundColor: op.color, position: 'relative', borderRadius: is3D ? '2px' : '4px 4px 0 0', boxShadow: is3D ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none', backgroundImage: is3D ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none', opacity: isDimmed ? 0.3 : 1, transform: isHovered ? 'translateY(-5px)' : 'none', transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '-38px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{op.cantidad}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
        {/* Etiquetas de mes (fuera de la transformación 3D para que no se deformen) */}
        <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.6rem 1rem 0 1rem', marginBottom: '1rem' }}>
          {sectores.map(op => (
            <div key={`lbl-${op.id}`} style={{ width: anchoCol, textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: hovered === op.id ? op.color : 'var(--text-muted)', transition: 'color 0.2s' }}>{op.label}</div>
          ))}
        </div>
      </div>
    );
  };

  // ---- TORTA / ANILLO (distribución por mes) con habladores que muestran el mes ----
  const renderDonut = () => {
    const sectores = datosGrafico.arr;
    const gradient = datosGrafico.gradient;
    const mascaraDonut = tipoGrafico === 'anillo' ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';
    return (
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: is3D ? '1rem auto 3.5rem auto' : '2rem 0 3rem 0', width: '100%', height: '380px' }}>
        {is3D ? (
          <div className="pie-chart-wrapper" style={{ margin: 0 }}>
            <div className="pie-chart-3d" style={{ width: '250px', height: '250px', position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(15deg)', transition: 'transform 0.6s' }}>
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: gradient, transform: `translateZ(-${i}px)`, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, filter: i > 0 ? 'brightness(0.65) contrast(1.2)' : 'none', opacity: hovered ? 0.8 : 1 } as React.CSSProperties}>
                  {i === 24 && <div className="pie-shadow" style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(20px)', transform: 'translateZ(-5px)' }}></div>}
                </div>
              ))}
            </div>
          </div>
        ) : (<div style={{ width: '240px', height: '240px', borderRadius: '50%', background: gradient, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.5s' } as React.CSSProperties} />)}

        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 100 }}>
          {sectores.map((op, index) => {
            const rad = (op.midAngle - 90) * (Math.PI / 180);
            const rBase = 115;
            const rCard = 150 + (index % 2 === 0 ? 0 : 35);
            let xBase = Math.cos(rad) * rBase;
            let yBase = Math.sin(rad) * rBase;
            let xCard = Math.cos(rad) * rCard;
            let yCard = Math.sin(rad) * rCard;

            if (is3D) {
              const a15 = 15 * (Math.PI / 180);
              const cos15 = Math.cos(a15), sin15 = Math.sin(a15);
              const apply3D = (x: number, y: number) => ({ x: x * cos15 - y * sin15, y: (x * sin15 + y * cos15) * 0.5 + 15 });
              const b = apply3D(xBase, yBase); const c = apply3D(xCard, yCard);
              xBase = b.x; yBase = b.y; xCard = c.x; yCard = c.y;
            }

            const isHovered = hovered === op.id;
            const isDimmed = hovered !== null && !isHovered;

            return (
              <div key={`hablador-${op.id}`}>
                <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', zIndex: 90, pointerEvents: 'none', opacity: isHovered ? 1 : 0.4 }}>
                  <line x1={xBase} y1={yBase} x2={xCard} y2={yCard} stroke={op.color} strokeWidth={isHovered ? '3' : '1.5'} strokeDasharray="4,3" />
                  <circle cx={xBase} cy={yBase} r="5" fill={op.color} />
                </svg>
                <div onMouseEnter={() => setHovered(op.id)} onMouseLeave={() => setHovered(null)}
                  style={{ position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`, backgroundColor: 'var(--bg-panel)', border: `2px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px', boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100, opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', cursor: 'pointer' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{op.label}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>{op.cantidad}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderGrafico = () => {
    if (datos.length === 0) {
      return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>Sin datos para graficar.</p>;
    }
    if (tipoGrafico === 'lineas') return renderLinea();
    if (tipoGrafico === 'barras') return renderBarras();
    return renderDonut();
  };

  const notaGrafico = () => {
    if (tipoGrafico === 'lineas') return modo === 'enteros' ? 'Número de inspecciones por mes.' : 'Variación porcentual respecto al mes anterior.';
    if (tipoGrafico === 'barras') return 'Número de inspecciones por mes.';
    return 'Distribución de inspecciones por mes (% del total anual).';
  };

  const fmtPct = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
  const fmtDelta = (v: number | null) => (v === null ? '-' : `${v >= 0 ? '+' : ''}${v}`);

  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <LineChart size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard de Inspecciones</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Evolución en enteros y porcentual</p>
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
          <label>Año</label>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {datos.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
          <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin inspecciones registradas</h3>
          <p style={{ color: 'var(--text-muted)' }}>Captura inspecciones en "Registro" para ver la evolución de {tallerSeleccionado || 'este taller'} en {ano}.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-title">Total {ano} <Sigma size={16} color="var(--primary)" /></div>
              <div className="kpi-value" style={{ color: 'var(--primary)' }}>{kpis.total}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Promedio mensual <LineChart size={16} /></div>
              <div className="kpi-value">{kpis.promedio.toFixed(1)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Mejor mes <Award size={16} color="var(--success)" /></div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.mejor.cantidad}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{kpis.mejor.mes}</div>
            </div>
            <div className="kpi-card" style={{ position: 'relative' }}>
              <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Variación último mes
                {kpis.variacionUltimo !== null && (kpis.variacionUltimo >= 0
                  ? <TrendingUp size={16} color="var(--success)" />
                  : <TrendingDown size={16} color="var(--danger)" />)}
              </div>
              <div className="kpi-value" style={{ color: kpis.variacionUltimo === null ? 'var(--text-muted)' : (kpis.variacionUltimo >= 0 ? 'var(--success)' : 'var(--danger)') }}>
                {kpis.variacionUltimo === null ? '-' : `${kpis.variacionUltimo >= 0 ? '+' : ''}${kpis.variacionUltimo.toFixed(1)}%`}
              </div>
            </div>
          </div>

          {/* GRÁFICA CON CONTROLES (como en el Dashboard) */}
          <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Evolución de inspecciones</h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Toggle Enteros / Variación % solo aplica a la gráfica de líneas */}
                {tipoGrafico === 'lineas' && (
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button onClick={() => setModo('enteros')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'enteros' ? 'var(--primary)' : 'transparent', color: modo === 'enteros' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Enteros</button>
                    <button onClick={() => setModo('porcentual')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'porcentual' ? 'var(--primary)' : 'transparent', color: modo === 'porcentual' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Variación %</button>
                  </div>
                )}

                {/* Selector de tipo de gráfico */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TIPO:</label>
                  <select value={tipoGrafico} onChange={(e) => setTipoGrafico(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                    <option value="lineas">Líneas (Line)</option>
                    <option value="barras">Barras (Bar)</option>
                    <option value="anillo">Anillo (Donut)</option>
                    <option value="torta">Torta (Pie)</option>
                  </select>
                </div>

                {/* Toggle 3D / 2D */}
                <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button onClick={() => setIs3D(true)} style={{ padding: '0.4rem 1rem', border: 'none', background: is3D ? 'var(--primary)' : 'transparent', color: is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>3D</button>
                  <button onClick={() => setIs3D(false)} style={{ padding: '0.4rem 1rem', border: 'none', background: !is3D ? 'var(--primary)' : 'transparent', color: !is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>2D</button>
                </div>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
              {renderGrafico()}
            </div>

            {/* LEYENDA: garantiza ver el mes en cualquier tipo de gráfico */}
            <ul className="legend-below-chart-list" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              {datosGrafico.arr.map(op => {
                const isHovered = hovered === op.id;
                const isDimmed = hovered !== null && !isHovered;
                return (
                  <li key={`leg-${op.id}`} onMouseEnter={() => setHovered(op.id)} onMouseLeave={() => setHovered(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: isHovered ? 'var(--sidebar-hover)' : 'transparent', cursor: 'pointer', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: op.color, boxShadow: `0 0 5px ${op.color}`, flexShrink: 0 }}></span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{op.label}</span>
                      <span style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-main)', fontWeight: 700 }}>{op.cantidad}</strong>
                        <strong style={{ color: op.color, fontWeight: 700, minWidth: '46px', textAlign: 'right' }}>{op.porcentajeStr}%</strong>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>{notaGrafico()}</p>
          </div>

          {/* TABLA DE EVOLUCIÓN */}
          <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
            <h3 className="detail-section-title">Detalle de evolución</h3>
            <table className="table" style={{ width: '100%', marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'center' }}>Inspecciones</th>
                  <th style={{ textAlign: 'center' }}>Variación (Δ)</th>
                  <th style={{ textAlign: 'center' }}>Variación %</th>
                  <th style={{ textAlign: 'center' }}>% del total</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.mes}>
                    <td><strong>{f.mes}</strong></td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-main)' }}>{f.cantidad}</td>
                    <td style={{ textAlign: 'center', color: f.deltaEntero === null ? 'var(--text-muted)' : (f.deltaEntero >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtDelta(f.deltaEntero)}</td>
                    <td style={{ textAlign: 'center', color: f.deltaPct === null ? 'var(--text-muted)' : (f.deltaPct >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtPct(f.deltaPct)}</td>
                    <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>{f.pctTotal.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total</strong></td>
                  <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{kpis.total}</td>
                  <td colSpan={2}></td>
                  <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
};