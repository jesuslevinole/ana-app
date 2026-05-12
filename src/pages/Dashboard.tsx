import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { PieChart as PieIcon, Target, TrendingUp, AlertTriangle, Printer } from 'lucide-react';

type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas';

// --- NUEVOS FORMATEADORES LOCALES PARA CUMPLIR TUS REGLAS ---
const miFormatearFecha = (fechaStr: string) => {
  if (!fechaStr || fechaStr === '-') return fechaStr;
  const partes = fechaStr.split('-'); // Asumiendo que entra como YYYY-MM-DD
  if (partes.length === 3) return `${partes[1]}/${partes[2]}/${partes[0]}`; 
  return fechaStr;
};

const miFormatearMoneda = (valor: number) => {
  // en-US asegura comas para miles y puntos para decimales
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor).replace('$', '$ ');
};

export const Dashboard = () => {
  const contexto = useContext(AppContext);
  if (!contexto) return null;
  const { registros, talleres } = contexto;

  // Estados de Filtro
  const [filtroAno, setFiltroAno] = useState<string>('Todos');
  const [filtroMes, setFiltroMes] = useState<string>('Todos');
  const [filtroTaller, setFiltroTaller] = useState<string>('Todos');

  // Estados de Control del Gráfico Superior (Operaciones)
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('anillo');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  // Estados de Control del Gráfico Inferior (Mensual)
  const [tipoGraficoMensual, setTipoGraficoMensual] = useState<TipoGrafico>('barras');
  const [is3DMensual, setIs3DMensual] = useState<boolean>(true);
  const [hoveredMes, setHoveredMes] = useState<string | null>(null);

  // Fecha actual para el reporte PDF (Forzada a MM/DD/YYYY local)
  const fechaReporte = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  // Listas únicas para selectores
  const anosDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.ano.toString()))).sort(), [registros]);
  const talleresDisponibles = useMemo(() => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(t => t.nombre), [talleres]);
  const tallerActivo = useMemo(() => filtroTaller === 'Todos' ? null : talleres.find(t => t.nombre === filtroTaller) || null, [filtroTaller, talleres]);

  // Lógica de Filtrado Principal
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      const matchAno = filtroAno === 'Todos' || r.ano.toString() === filtroAno;
      const matchMes = filtroMes === 'Todos' || r.mes === filtroMes;
      const matchTaller = filtroTaller === 'Todos' || r.taller === filtroTaller;
      return matchAno && matchMes && matchTaller;
    });
  }, [registros, filtroAno, filtroMes, filtroTaller]);

  // Cálculos de KPIs Agregados (CON LÓGICA DE EXCEDENTE)
  const kpis = useMemo(() => {
    const metaTotal = registrosFiltrados.reduce((acc, r) => acc + r.meta, 0);
    const logradoTotal = registrosFiltrados.reduce((acc, r) => acc + r.logrado, 0);
    const isExcedente = logradoTotal > metaTotal;
    const faltanteTotal = isExcedente ? logradoTotal - metaTotal : Math.max(metaTotal - logradoTotal, 0);
    const porcentajeGlobal = metaTotal > 0 ? Math.min(Number(((logradoTotal / metaTotal) * 100).toFixed(2)), 100) : 0;
    return { metaTotal, logradoTotal, faltanteTotal, porcentajeGlobal, isExcedente };
  }, [registrosFiltrados]);

  // Análisis de Operaciones para el Gráfico Principal
  const analisisOperaciones = useMemo(() => {
    const listaOperaciones = registrosFiltrados.flatMap(r => r.detalles.map(d => ({ ...d, tallerPadre: r.taller })));
    const totalVendido = listaOperaciones.reduce((acc, op) => acc + op.vendido, 0);
    const metaTotal = registrosFiltrados.reduce((acc, r) => acc + r.meta, 0);
    
    if (totalVendido === 0 && metaTotal === 0) return null;

    const baseCalculo = Math.max(metaTotal, totalVendido);
    const colores = ['#1d8cf8', '#00d6b4', '#ffbc11', '#d048b6', '#51cbce', '#8965e0', '#2dce89'];
    let acumuladoGrados = 0;
    
    const operacionesConSectores = listaOperaciones.map((op, index) => {
      const porcentajeOp = baseCalculo > 0 ? (op.vendido / baseCalculo) * 100 : 0;
      const grados = (porcentajeOp / 100) * 360;
      const midAngle = acumuladoGrados + (grados / 2);
      const color = colores[index % colores.length];
      const inicio = acumuladoGrados;
      acumuladoGrados += grados;
      return { 
        ...op, 
        isFaltante: false, 
        semanaIndex: String(index + 1), 
        porcentajeStr: porcentajeOp.toFixed(2), 
        porcentajeOpRaw: porcentajeOp, 
        midAngle, 
        color, 
        gradientPart: `${color} ${inicio}deg ${acumuladoGrados}deg` 
      };
    });

    let excedenteObj = null;

    if (metaTotal > totalVendido) {
      const faltante = metaTotal - totalVendido;
      const porcentajeFaltante = (faltante / baseCalculo) * 100;
      const gradosFaltante = (porcentajeFaltante / 100) * 360;
      const midAngleFaltante = acumuladoGrados + (gradosFaltante / 2);
      const colorFaltante = '#ff4c4c'; 
      const inicioFaltante = acumuladoGrados;
      acumuladoGrados += gradosFaltante;
      operacionesConSectores.push({
        id: 'faltante-item', isFaltante: true, semanaIndex: '-', desde: '-', hasta: '-', vendido: faltante,
        porcentajeStr: porcentajeFaltante.toFixed(2), 
        porcentajeOpRaw: porcentajeFaltante, 
        midAngle: midAngleFaltante, color: colorFaltante,
        gradientPart: `${colorFaltante} ${inicioFaltante}deg ${acumuladoGrados}deg`, tallerPadre: '-', porcentajeAporte: 0
      });
    } else if (totalVendido > metaTotal) {
      // SI HAY EXCEDENTE: Lo guardamos para agregarlo en la tabla, pero NO en el gráfico
      excedenteObj = {
        valor: totalVendido - metaTotal,
        porcentaje: metaTotal > 0 ? ((totalVendido - metaTotal) / metaTotal) * 100 : 100
      };
    }

    return { operaciones: operacionesConSectores, gradient: `conic-gradient(${operacionesConSectores.map(o => o.gradientPart).join(', ')})`, totalVendido, excedenteObj };
  }, [registrosFiltrados]);

  // Lógica de Reporte Mensual
  const reporteMensual = useMemo(() => {
    const datosPorMes = MESES.map(mes => {
      const registrosMes = registros.filter(r => (filtroAno === 'Todos' || r.ano.toString() === filtroAno) && (filtroTaller === 'Todos' || r.taller === filtroTaller) && r.mes === mes);
      const meta = registrosMes.reduce((acc, r) => acc + r.meta, 0);
      const ventas = registrosMes.reduce((acc, r) => acc + r.logrado, 0);
      const isExcedente = ventas > meta;
      const porCumplir = isExcedente ? ventas - meta : Math.max(meta - ventas, 0);
      return { 
        mes, 
        meta, 
        ventas, 
        pctVentas: meta > 0 ? (ventas / meta) * 100 : 0, 
        porCumplir,
        isExcedente,
        pctPorCumplir: meta > 0 ? (porCumplir / meta) * 100 : 0 
      };
    });
    const totales = { meta: datosPorMes.reduce((acc, m) => acc + m.meta, 0), ventas: datosPorMes.reduce((acc, m) => acc + m.ventas, 0) };
    return { datosPorMes, totales: { ...totales, porCumplir: Math.abs(totales.meta - totales.ventas), isExcedente: totales.ventas > totales.meta } };
  }, [registros, filtroAno, filtroTaller]);

  // Análisis de Datos para el Gráfico Mensual
  const datosGraficoMensual = useMemo(() => {
    const mesesConVentas = reporteMensual.datosPorMes.filter(d => d.ventas > 0);
    if (mesesConVentas.length === 0) return null;

    const totalVentasMensuales = mesesConVentas.reduce((acc, d) => acc + d.ventas, 0);
    const colores = ['#1d8cf8', '#00d6b4', '#ff8d72', '#d048b6', '#ffbc11', '#51cbce', '#8965e0', '#2dce89', '#f56036', '#c72e6b', '#2a86ff', '#e2d849'];
    let acumuladoGrados = 0;

    const operacionesConSectores = mesesConVentas.map((op, index) => {
      const porcentajeOp = (op.ventas / totalVentasMensuales) * 100;
      const grados = (porcentajeOp / 100) * 360;
      const color = colores[index % colores.length];
      const inicio = acumuladoGrados;
      acumuladoGrados += grados;
      return { id: op.mes, label: op.mes, vendido: op.ventas, porcentajeStr: porcentajeOp.toFixed(2), midAngle: inicio + (grados / 2), color, gradientPart: `${color} ${inicio}deg ${acumuladoGrados}deg` };
    });

    return { operaciones: operacionesConSectores, gradient: `conic-gradient(${operacionesConSectores.map(o => o.gradientPart).join(', ')})`, totalVendido: totalVentasMensuales };
  }, [reporteMensual]);

  // --- RENDERIZADOR GRÁFICO SUPERIOR (WEB CON FLECHAS) ---
  const renderGrafico = () => {
    if (!analisisOperaciones) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos para graficar.</p>;
    const { operaciones, gradient } = analisisOperaciones;
    const maxVendido = Math.max(...operaciones.map(o => o.vendido));

    if (tipoGrafico === 'torta' || tipoGrafico === 'anillo') {
      const mascaraDonut = tipoGrafico === 'anillo' ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';
      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: is3D ? '1rem auto 3.5rem auto' : '2rem 0 3rem 0', width: '100%', height: '260px' }}>
          {is3D ? (
            <div className="pie-chart-wrapper" style={{ margin: 0 }}>
              <div className="pie-chart-3d" style={{ width: '250px', height: '250px', position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(15deg)', transition: 'transform 0.6s' }}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: gradient, transform: `translateZ(-${i}px)`, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, filter: i > 0 ? 'brightness(0.65) contrast(1.2)' : 'none', opacity: hoveredOp ? 0.8 : 1 } as React.CSSProperties}>
                    {i === 24 && <div className="pie-shadow" style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(20px)', transform: 'translateZ(-5px)' }}></div>}
                  </div>
                ))}
              </div>
            </div>
          ) : ( <div style={{ width: '240px', height: '240px', borderRadius: '50%', background: gradient, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.5s' } as React.CSSProperties} /> )}
          
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 100 }}>
            {operaciones.map(op => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              
              // Ajustes de distancia solicitados
              const rBase = is3D ? 120 : 120; // Borde del gráfico
              const rCard = is3D ? 230 : 210; // Tarjeta mucho más lejos

              let xBase = Math.cos(rad) * rBase;
              let yBase = Math.sin(rad) * rBase;
              let xCard = Math.cos(rad) * rCard;
              let yCard = Math.sin(rad) * rCard;

              if (is3D) {
                const angle15 = 15 * (Math.PI / 180);
                const apply3D = (x: number, y: number) => {
                  const ySquashed = y * 0.5;
                  return {
                    x: x * Math.cos(angle15) - ySquashed * Math.sin(angle15),
                    y: x * Math.sin(angle15) + ySquashed * Math.cos(angle15) + 15
                  }
                };
                const base3d = apply3D(xBase, yBase);
                const card3d = apply3D(xCard, yCard);
                xBase = base3d.x; yBase = base3d.y;
                xCard = card3d.x; yCard = card3d.y;
              }

              const isHovered = hoveredOp === op.id;
              const isDimmed = hoveredOp !== null && !isHovered;

              return (
                <div key={`hablador-${op.id}`}>
                  {/* Flecha/Línea Señalizadora */}
                  {isHovered && (
                    <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', zIndex: 90, pointerEvents: 'none' }}>
                      <line x1={xBase} y1={yBase} x2={xCard} y2={yCard} stroke={op.color} strokeWidth="2" strokeDasharray="3,3" />
                      <circle cx={xBase} cy={yBase} r="5" fill={op.color} />
                    </svg>
                  )}
                  
                  <div onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                    style={{ position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`, backgroundColor: 'var(--bg-panel)', border: `2px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px', boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100, opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{miFormatearMoneda(op.vendido)}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                  </div>
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
                style={{ width: `${Math.max(15, 60 / operaciones.length)}%`, height: `${altura}%`, backgroundColor: op.color, position: 'relative', borderRadius: is3D ? '2px' : '4px 4px 0 0', boxShadow: is3D ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none', backgroundImage: is3D ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none', opacity: isDimmed ? 0.3 : 1, transform: isHovered ? 'translateY(-5px)' : 'none', transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{miFormatearMoneda(op.vendido)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (tipoGrafico === 'lineas') {
      const puntosLinea = operaciones.map((op, i) => `${(i / Math.max(1, operaciones.length - 1)) * 100},${100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0)}`).join(' ');
      return (
        <div style={{ height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(30deg) rotateY(-15deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', position: 'absolute', inset: 0 }}>
            {is3D && <filter id="shadow-line"><feDropShadow dx="0" dy="15" stdDeviation="5" floodColor="rgba(0,0,0,0.7)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3D ? "url(#shadow-line)" : "none"} vectorEffect="non-scaling-stroke" />
          </svg>
          {operaciones.map((op, i) => {
            const x = (i / Math.max(1, operaciones.length - 1)) * 100;
            const y = 100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0);
            const isHovered = hoveredOp === op.id;
            const isDimmed = hoveredOp !== null && !isHovered;
            return (
              <div key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: '14px', height: '14px', backgroundColor: op.color, borderRadius: '50%', transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.5)' : 'scale(1)'}`, border: '2px solid var(--bg-panel)', boxShadow: is3D ? '0 4px 6px rgba(0,0,0,0.5)' : 'none', zIndex: isHovered ? 20 : 10, opacity: isDimmed ? 0.3 : 1, transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isHovered ? 1 : (isDimmed ? 0 : 1), transition: 'opacity 0.2s' }}>
                   <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
  };

  // --- RENDERIZADOR GRÁFICO INFERIOR (WEB CON FLECHAS) ---
  const renderGraficoMensual = () => {
    if (!datosGraficoMensual) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos mensuales para graficar.</p>;
    const { operaciones, gradient } = datosGraficoMensual;
    const maxVendido = Math.max(...operaciones.map(o => o.vendido));

    if (tipoGraficoMensual === 'torta' || tipoGraficoMensual === 'anillo') {
      const mascaraDonut = tipoGraficoMensual === 'anillo' ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';
      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: is3DMensual ? '1rem auto 3.5rem auto' : '2rem 0 3rem 0', width: '100%', height: '260px' }}>
          {is3DMensual ? (
            <div className="pie-chart-wrapper" style={{ margin: 0 }}>
              <div className="pie-chart-3d" style={{ width: '250px', height: '250px', position: 'relative', transformStyle: 'preserve-3d', transform: 'rotateX(60deg) rotateZ(15deg)', transition: 'transform 0.6s' }}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: gradient, transform: `translateZ(-${i}px)`, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, filter: i > 0 ? 'brightness(0.65) contrast(1.2)' : 'none', opacity: hoveredMes ? 0.8 : 1 } as React.CSSProperties}>
                    {i === 24 && <div className="pie-shadow" style={{ position: 'absolute', inset: '-5px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', filter: 'blur(20px)', transform: 'translateZ(-5px)' }}></div>}
                  </div>
                ))}
              </div>
            </div>
          ) : ( <div style={{ width: '240px', height: '240px', borderRadius: '50%', background: gradient, WebkitMaskImage: mascaraDonut, maskImage: mascaraDonut, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'all 0.5s' } as React.CSSProperties} /> )}
          
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 100 }}>
            {operaciones.map(op => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              
              const rBase = is3DMensual ? 120 : 120; 
              const rCard = is3DMensual ? 230 : 210; 

              let xBase = Math.cos(rad) * rBase;
              let yBase = Math.sin(rad) * rBase;
              let xCard = Math.cos(rad) * rCard;
              let yCard = Math.sin(rad) * rCard;

              if (is3DMensual) {
                const angle15 = 15 * (Math.PI / 180);
                const apply3D = (x: number, y: number) => {
                  const ySquashed = y * 0.5;
                  return {
                    x: x * Math.cos(angle15) - ySquashed * Math.sin(angle15),
                    y: x * Math.sin(angle15) + ySquashed * Math.cos(angle15) + 15
                  }
                };
                const base3d = apply3D(xBase, yBase);
                const card3d = apply3D(xCard, yCard);
                xBase = base3d.x; yBase = base3d.y;
                xCard = card3d.x; yCard = card3d.y;
              }

              const isHovered = hoveredMes === op.id;
              const isDimmed = hoveredMes !== null && !isHovered;

              return (
                <div key={`hablador-mes-${op.id}`}>
                  {isHovered && (
                    <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', zIndex: 90, pointerEvents: 'none' }}>
                      <line x1={xBase} y1={yBase} x2={xCard} y2={yCard} stroke={op.color} strokeWidth="2" strokeDasharray="3,3" />
                      <circle cx={xBase} cy={yBase} r="5" fill={op.color} />
                    </svg>
                  )}
                  
                  <div onMouseEnter={() => setHoveredMes(op.id)} onMouseLeave={() => setHoveredMes(null)}
                    style={{ position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`, backgroundColor: 'var(--bg-panel)', border: `2px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px', boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100, opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>{miFormatearMoneda(op.vendido)}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (tipoGraficoMensual === 'barras') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3DMensual ? 'perspective(1000px) rotateX(20deg) rotateY(-10deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          {operaciones.map((op) => {
            const altura = maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0;
            const isHovered = hoveredMes === op.id;
            const isDimmed = hoveredMes !== null && !isHovered;
            return (
              <div key={op.id} onMouseEnter={() => setHoveredMes(op.id)} onMouseLeave={() => setHoveredMes(null)}
                style={{ width: `${Math.max(10, 60 / operaciones.length)}%`, height: `${altura}%`, backgroundColor: op.color, position: 'relative', borderRadius: is3DMensual ? '2px' : '4px 4px 0 0', boxShadow: is3DMensual ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none', backgroundImage: is3DMensual ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none', opacity: isDimmed ? 0.3 : 1, transform: isHovered ? 'translateY(-5px)' : 'none', transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3DMensual ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{miFormatearMoneda(op.vendido)}</span>
                   <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color }}>{op.porcentajeStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (tipoGraficoMensual === 'lineas') {
      const puntosLinea = operaciones.map((op, i) => `${(i / Math.max(1, operaciones.length - 1)) * 100},${100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0)}`).join(' ');
      return (
        <div style={{ height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3DMensual ? 'perspective(1000px) rotateX(30deg) rotateY(-15deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', position: 'absolute', inset: 0 }}>
            {is3DMensual && <filter id="shadow-mensual-lineas"><feDropShadow dx="0" dy="15" stdDeviation="5" floodColor="rgba(0,0,0,0.7)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3DMensual ? "url(#shadow-mensual-lineas)" : "none"} vectorEffect="non-scaling-stroke" />
          </svg>
          {operaciones.map((op, i) => {
            const x = (i / Math.max(1, operaciones.length - 1)) * 100;
            const y = 100 - (maxVendido > 0 ? (op.vendido / maxVendido) * 85 : 0);
            const isHovered = hoveredMes === op.id;
            const isDimmed = hoveredMes !== null && !isHovered;
            return (
              <div key={op.id} onMouseEnter={() => setHoveredMes(op.id)} onMouseLeave={() => setHoveredMes(null)}
                style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: '14px', height: '14px', backgroundColor: op.color, borderRadius: '50%', transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.5)' : 'scale(1)'}`, border: '2px solid var(--bg-panel)', boxShadow: is3DMensual ? '0 4px 6px rgba(0,0,0,0.5)' : 'none', zIndex: isHovered ? 20 : 10, opacity: isDimmed ? 0.3 : 1, transition: 'all 0.3s ease', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isHovered ? 1 : (isDimmed ? 0 : 1), transition: 'opacity 0.2s' }}>
                   <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
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
    <>
      {/* MAGIA CSS: ESTILOS QUE SEPARAN LA WEB DE LA IMPRESIÓN */}
      <style>{`
        @media screen {
          .print-only-report { display: none !important; }
        }
        
        @media print {
          /* PDF EN HORIZONTAL LANDSCAPE */
          @page { size: A4 landscape; margin: 15mm 10mm; }
          
          /* RESETEAR CONTENEDORES WEB PARA LA IMPRESIÓN */
          html, body, #root, .app-layout, .main-content {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          /* OCULTAR TODO EL DASHBOARD WEB */
          .web-only-dashboard, .sidebar, .top-nav { display: none !important; }
          
          /* MOSTRAR SOLO EL REPORTE ESTÁTICO */
          .print-only-report { 
            display: block !important; 
            width: 100% !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          /* ESTILOS EXCLUSIVOS DEL REPORTE IMPRESO */
          .print-only-report .report-header {
            display: flex !important; justify-content: space-between !important; align-items: flex-end !important;
            background-color: #1e293b !important; color: #ffffff !important;
            padding: 25px !important; margin-bottom: 25px !important; border-radius: 12px !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .print-only-report .report-header h1 { color: #ffffff !important; font-size: 24pt !important; margin: 0 !important; }
          .print-only-report .report-header p { color: #cbd5e1 !important; }

          .print-only-report .section-executive-title {
            display: block !important; font-size: 13pt !important; font-weight: 800 !important; color: #1e293b !important;
            text-transform: uppercase !important; margin: 25px 0 15px 0 !important; border-left: 5px solid #1d8cf8 !important;
            padding-left: 10px !important; page-break-after: avoid !important;
          }
          .print-only-report .kpi-print-row {
            display: flex !important; gap: 15px !important; margin-bottom: 25px !important; page-break-inside: avoid !important;
          }
          .print-only-report .kpi-item {
            flex: 1 !important; border: 1px solid #e2e8f0 !important; padding: 15px !important; text-align: center !important;
            background: #f8fafc !important; border-radius: 8px !important;
          }
          .print-only-report .kpi-val { font-size: 14pt !important; font-weight: 900 !important; margin-top: 5px !important; }
          .print-only-report .card-print {
            border: 1px solid #e2e8f0 !important; border-radius: 10px !important; margin-bottom: 25px !important;
            padding: 15px !important; page-break-inside: avoid !important;
          }
          .print-only-report table { width: 100% !important; border-collapse: collapse !important; }
          .print-only-report th { background: #f1f5f9 !important; padding: 8px !important; border-bottom: 2px solid #cbd5e1 !important; font-size: 9pt !important; text-align: left; }
          .print-only-report td { padding: 8px !important; border-bottom: 1px solid #f1f5f9 !important; font-size: 9pt !important; }
          .print-only-report tr:nth-child(even) { background: #fcfcfc !important; }
          
          .print-only-report .chart-print-box { position: relative !important; height: 350px !important; display: flex !important; justify-content: center !important; align-items: center !important; margin: 15px 0 !important; }
          
          .print-only-report .page-break { page-break-before: always !important; height: 1px !important; display: block !important; margin: 0 !important; }
          
          * { scrollbar-width: none !important; }
          ::-webkit-scrollbar { display: none !important; }
        }
      `}</style>

      {/* =========================================================================
          1. VISTA WEB ORIGINAL (INTACTA E INTERACTIVA)
      ========================================================================= */}
      <div className="web-only-dashboard animate-in fade-in">
        <div className="page-header">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {tallerActivo && tallerActivo.logo ? (
              <div style={{ width: '180px', height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)' }}>
                <img src={tallerActivo.logo} alt={tallerActivo.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <PieIcon size={32} color="var(--primary)" />
            )}
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Executive Dashboard {tallerActivo ? `- ${tallerActivo.nombre}` : ''}</h2>
              <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Visualización Dinámica e Inteligencia de Datos</p>
            </div>
          </div>
          <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}>
            <Printer size={18} /> Exportar PDF
          </button>
        </div>

        <div className="filter-bar">
          <div className="filter-group"><label>Año</label><select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}><option value="Todos">Todos los años</option>{anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="filter-group"><label>Mes</label><select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}><option value="Todos">Todos los meses</option>{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="filter-group"><label>Taller</label><select value={filtroTaller} onChange={(e) => setFiltroTaller(e.target.value)}><option value="Todos">Todos los talleres</option>{talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card meta"><div className="kpi-title">Meta Total <Target size={16} /></div><div className="kpi-value">{miFormatearMoneda(kpis.metaTotal)}</div></div>
          <div className="kpi-card logrado"><div className="kpi-title">Logrado <TrendingUp size={16} color="var(--primary)" /></div><div className="kpi-value" style={{ color: 'var(--primary)' }}>{miFormatearMoneda(kpis.logradoTotal)}</div></div>
          
          <div className="kpi-card faltante" style={kpis.isExcedente ? { borderLeftColor: 'var(--success)' } : {}}>
            <div className="kpi-title" style={{ color: kpis.isExcedente ? 'var(--success)' : 'var(--danger)' }}>
              {kpis.isExcedente ? 'Excedente' : 'Faltante'} <AlertTriangle size={16} />
            </div>
            <div className="kpi-value" style={{ color: kpis.isExcedente ? 'var(--success)' : 'var(--danger)' }}>
              {miFormatearMoneda(kpis.faltanteTotal)}
            </div>
          </div>
          
          <div className="kpi-card">
            <div className="circular-progress-container">
              <div><div className="kpi-title">Cumplido</div><div className="kpi-subtitle">Total</div></div>
              <div className="circular-progress" style={{ background: `conic-gradient(${kpis.porcentajeGlobal >= 100 ? 'var(--success)' : 'var(--primary)'} ${kpis.porcentajeGlobal * 3.6}deg, var(--bg-body) 0deg)` }}><span className="circular-progress-value">{kpis.porcentajeGlobal}%</span></div>
            </div>
          </div>
        </div>

        {/* LAYOUT 2 COLUMNAS (TABLA IZQ, GRÁFICO DER) */}
        <div className="dashboard-grid-custom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3 className="detail-section-title">Progreso de la Meta (Operaciones #)</h3>
            <div className="table-wrapper" style={{ boxShadow: 'none', border: 'none', background: 'transparent', marginTop: '1rem' }}>
              <table className="table" style={{ width: '100%' }}>
                <thead><tr><th style={{ width: '60px', textAlign: 'center' }}># Ref</th><th>Desde / Hasta</th><th style={{ textAlign: 'right' }}>Venta</th><th style={{ textAlign: 'center' }}>%</th></tr></thead>
                <tbody>
                  {!analisisOperaciones ? (<tr><td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No se encontraron registros activos.</td></tr>) : (
                    <>
                      {analisisOperaciones.operaciones.map((op) => {
                        const isHovered = hoveredOp === op.id;
                        const isDimmed = hoveredOp !== null && !isHovered;
                        return (
                          <tr key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)} style={{ backgroundColor: isHovered ? 'var(--bg-highlight)' : 'transparent', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}>
                            {op.isFaltante ? (
                              <>
                                <td style={{ textAlign: 'center' }}><span className="op-badge" style={{ backgroundColor: op.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}><AlertTriangle size={12} /></span></td>
                                <td><div style={{fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 700}}>Faltante por Cumplir</div><div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Meta no alcanzada</div></td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>{miFormatearMoneda(op.vendido)}</td>
                                <td style={{ textAlign: 'center' }}><span style={{ color: 'var(--danger)', fontWeight: 800, fontSize: '0.85rem' }}>{op.porcentajeStr}%</span></td>
                              </>
                            ) : (
                              <>
                                <td style={{ textAlign: 'center' }}><span className="op-badge" style={{ backgroundColor: op.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{op.semanaIndex}</span></td>
                                <td><div style={{fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 600}}>{miFormatearFecha(op.desde)}</div><div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{miFormatearFecha(op.hasta)}</div></td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{miFormatearMoneda(op.vendido)}</td>
                                <td style={{ textAlign: 'center' }}><span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.85rem' }}>{op.porcentajeStr}%</span></td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                      
                      {/* NUEVA FILA DE EXCEDENTE (SOLO SI APLICA) */}
                      {analisisOperaciones.excedenteObj && (
                        <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="op-badge" style={{ backgroundColor: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '6px', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                              <TrendingUp size={12} />
                            </span>
                          </td>
                          <td>
                            <div style={{fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700}}>Excedente Logrado</div>
                            <div style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>Meta superada</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                            {miFormatearMoneda(analisisOperaciones.excedenteObj.valor)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.85rem' }}>
                              +{analisisOperaciones.excedenteObj.porcentaje.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TIPO DE GRÁFICO:</label>
                <select value={tipoGrafico} onChange={(e) => setTipoGrafico(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                  <option value="anillo">Anillo (Donut)</option><option value="torta">Torta (Pie)</option><option value="barras">Barras (Bar)</option><option value="lineas">Líneas (Line)</option>
                </select>
              </div>
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <button style={{ padding: '0.4rem 1rem', border: 'none', background: is3D ? 'var(--primary)' : 'transparent', color: is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setIs3D(true)}>3D</button>
                <button style={{ padding: '0.4rem 1rem', border: 'none', background: !is3D ? 'var(--primary)' : 'transparent', color: !is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setIs3D(false)}>2D</button>
              </div>
            </div>
            {renderGrafico()}
            {analisisOperaciones && (
              <ul className="legend-below-chart-list" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                {analisisOperaciones.operaciones.map((op) => {
                  const isHovered = hoveredOp === op.id;
                  const isDimmed = hoveredOp !== null && !isHovered;
                  return (
                    <li key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: isHovered ? 'var(--sidebar-hover)' : 'transparent', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: op.color, boxShadow: `0 0 5px ${op.color}`, flexShrink: 0 }}></span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                        <span style={{fontWeight: 500}}>{op.isFaltante ? 'Faltante por Cumplir' : `Venta semana ${op.semanaIndex}`}</span>
                        <strong style={{ color: op.isFaltante ? 'var(--danger)' : 'var(--text-main)', fontWeight: 600 }}>{op.porcentajeStr}%</strong>
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
            <thead><tr><th>Mes</th><th style={{ textAlign: 'right' }}>Meta</th><th style={{ textAlign: 'right' }}>Ventas</th><th style={{ textAlign: 'center' }}>%</th><th style={{ textAlign: 'right' }}>Diferencia</th><th style={{ textAlign: 'center' }}>Estado</th></tr></thead>
            <tbody>
              {reporteMensual.datosPorMes.map(fila => (
                <tr key={fila.mes}>
                  <td><strong>{fila.mes}</strong></td>
                  <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fila.meta > 0 ? miFormatearMoneda(fila.meta) : '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: fila.ventas > 0 ? 600 : 400, color: fila.ventas > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>{fila.ventas > 0 ? miFormatearMoneda(fila.ventas) : '-'}</td>
                  <td style={{ textAlign: 'center' }}>{fila.meta > 0 && <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem' }}>{fila.pctVentas.toFixed(2)}%</span>}</td>
                  <td style={{ textAlign: 'right', color: fila.isExcedente ? 'var(--success)' : (fila.porCumplir > 0 ? 'var(--danger)' : 'var(--text-muted)') }}>{fila.meta > 0 ? miFormatearMoneda(fila.porCumplir) : '-'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {fila.meta > 0 && <span style={{ color: fila.isExcedente ? 'var(--success)' : 'var(--danger)', fontSize: '0.7rem', fontWeight: 800, padding: '4px 8px', borderRadius: '12px', border: `1px solid ${fila.isExcedente ? 'var(--success)' : 'var(--danger)'}` }}>
                      {fila.isExcedente ? 'EXCEDENTE' : 'FALTANTE'}
                    </span>}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* LÓGICA DE EXCEDENTE EN EL FOOTER DE LA TABLA */}
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                {(() => {
                   return (
                     <>
                        <td style={{ padding: '1rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Total</strong></td>
                        <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{miFormatearMoneda(reporteMensual.totales.meta)}</td>
                        <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{miFormatearMoneda(reporteMensual.totales.ventas)}</td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: 'var(--primary)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.ventas / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
                        <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: reporteMensual.totales.isExcedente ? 'var(--success)' : 'var(--danger)' }}>
                           <div style={{fontSize: '0.7rem', textTransform: 'uppercase'}}>{reporteMensual.totales.isExcedente ? 'Excedente Total' : 'Faltante Total'}</div>
                           {miFormatearMoneda(reporteMensual.totales.porCumplir)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: reporteMensual.totales.isExcedente ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.porCumplir / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
                     </>
                   )
                })()}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TENDENCIA MENSUAL:</label>
              <select value={tipoGraficoMensual} onChange={(e) => setTipoGraficoMensual(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                <option value="barras">Barras (Bar)</option><option value="lineas">Líneas (Line)</option><option value="anillo">Anillo (Donut)</option><option value="torta">Torta (Pie)</option>
              </select>
            </div>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <button style={{ padding: '0.4rem 1rem', border: 'none', background: is3DMensual ? 'var(--primary)' : 'transparent', color: is3DMensual ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setIs3DMensual(true)}>3D</button>
              <button style={{ padding: '0.4rem 1rem', border: 'none', background: !is3DMensual ? 'var(--primary)' : 'transparent', color: !is3DMensual ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }} onClick={() => setIs3DMensual(false)}>2D</button>
            </div>
          </div>
          <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
            {renderGraficoMensual()}
          </div>
          {datosGraficoMensual && (
            <ul className="legend-below-chart-list" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', width: '100%', maxWidth: '800px', gap: '0.5rem' }}>
              {datosGraficoMensual.operaciones.map((op) => {
                const isHovered = hoveredMes === op.id;
                const isDimmed = hoveredMes !== null && !isHovered;
                return (
                  <li key={op.id} onMouseEnter={() => setHoveredMes(op.id)} onMouseLeave={() => setHoveredMes(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: isHovered ? 'var(--sidebar-hover)' : 'transparent', cursor: 'pointer', opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', padding: '0.4rem', borderRadius: '6px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: op.color, boxShadow: `0 0 5px ${op.color}`, flexShrink: 0 }}></span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
                      <span style={{fontWeight: 500}}>Ventas {op.label}</span>
                      <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{op.porcentajeStr}%</strong>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* =========================================================================
          2. VISTA PDF EXCLUSIVA (TOTALMENTE OCULTA EN LA WEB)
      ========================================================================= */}
      <div className="print-only-report">
        
        <div className="report-header">
          <div>
            <h1 style={{ fontSize: '24pt', margin: 0 }}>Reporte de Gestión Ejecutiva</h1>
            <p style={{ fontSize: '11pt', marginTop: '5px' }}>
              {tallerActivo ? `Sucursal: ${tallerActivo.nombre}` : 'Consolidado Global de Operaciones'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '12pt' }}>{fechaReporte}</p>
          </div>
        </div>

        <h3 className="section-executive-title">Resumen de Indicadores Clave (KPIs)</h3>
        <div className="kpi-print-row">
          <div className="kpi-item"><div style={{fontSize:'8pt', color:'#64748b'}}>META PROGRAMADA</div><div className="kpi-val">{miFormatearMoneda(kpis.metaTotal)}</div></div>
          <div className="kpi-item" style={{borderLeft:'4px solid #1d8cf8'}}><div style={{fontSize:'8pt', color:'#1d8cf8'}}>LOGRADO A LA FECHA</div><div className="kpi-val" style={{color:'#1d8cf8'}}>{miFormatearMoneda(kpis.logradoTotal)}</div></div>
          
          <div className="kpi-item" style={kpis.isExcedente ? {borderLeft:'4px solid #10b981'} : {}}>
            <div style={{fontSize:'8pt', color: kpis.isExcedente ? '#10b981' : '#f56036', fontWeight: 800}}>{kpis.isExcedente ? 'EXCEDENTE' : 'DÉFICIT / FALTANTE'}</div>
            <div className="kpi-val" style={{color: kpis.isExcedente ? '#10b981' : '#f56036'}}>{miFormatearMoneda(kpis.faltanteTotal)}</div>
          </div>
          
          <div className="kpi-item"><div style={{fontSize:'8pt', color:'#10b981'}}>% CUMPLIMIENTO</div><div className="kpi-val" style={{color:'#10b981'}}>{kpis.porcentajeGlobal}%</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          <div className="card-print">
            <h3 className="section-executive-title" style={{marginTop:0, border: 'none'}}>Detalle Operativo Semanal</h3>
            <table>
              <thead><tr><th style={{textAlign:'center'}}>REF</th><th>PERIODO DE ACTIVIDAD</th><th style={{textAlign:'right'}}>MONTO</th><th style={{textAlign:'center'}}>%</th></tr></thead>
              <tbody>
                {analisisOperaciones?.operaciones.map((op) => (
                  <tr key={`print-${op.id}`}>
                    <td style={{textAlign:'center', fontWeight:700}}>{op.semanaIndex}</td>
                    <td>{op.isFaltante ? 'Faltante de Cierre' : `${miFormatearFecha(op.desde)} al ${miFormatearFecha(op.hasta)}`}</td>
                    <td style={{textAlign:'right', fontWeight:700, color: op.isFaltante ? '#f56036' : '#1e293b'}}>{miFormatearMoneda(op.vendido)}</td>
                    <td style={{textAlign:'center'}}>{op.porcentajeStr}%</td>
                  </tr>
                ))}
                {/* FILA DE EXCEDENTE EN LA TABLA DEL PDF */}
                {analisisOperaciones?.excedenteObj && (
                  <tr>
                    <td style={{textAlign:'center', fontWeight:700}}>-</td>
                    <td style={{color: '#10b981', fontWeight: 700}}>Excedente Logrado</td>
                    <td style={{textAlign:'right', fontWeight:700, color: '#10b981'}}>{miFormatearMoneda(analisisOperaciones.excedenteObj.valor)}</td>
                    <td style={{textAlign:'center', color: '#10b981', fontWeight: 700}}>+{analisisOperaciones.excedenteObj.porcentaje.toFixed(2)}%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card-print">
            <h3 className="section-executive-title" style={{marginTop:0, border: 'none'}}>Distribución de Logros</h3>
            <div className="chart-print-box">
              
              {/* SOLUCIÓN AL GRÁFICO EN PDF (VECTORES SVG) */}
              <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                <svg width="200" height="200" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)', overflow: 'visible', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
                  {(() => {
                    let offsetSvg = 0;
                    return analisisOperaciones?.operaciones.map(op => {
                      const percentVal = typeof op.porcentajeOpRaw === 'number' ? op.porcentajeOpRaw : parseFloat(op.porcentajeStr);
                      const dash = `${percentVal} ${100 - percentVal}`;
                      const currentOff = -offsetSvg;
                      offsetSvg += percentVal;
                      return (
                        <circle
                          key={`svg-print-${op.id}`}
                          cx="21" cy="21" r="15.9154943"
                          fill="transparent"
                          stroke={op.color}
                          strokeWidth="8"
                          strokeDasharray={dash}
                          strokeDashoffset={currentOff}
                        />
                      );
                    });
                  })()}
                </svg>

                {/* Etiquetas CON SEÑALADORES (Líneas) alrededor del gráfico PDF */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, zIndex: 10 }}>
                  {analisisOperaciones?.operaciones.map((op) => {
                    const rad = (op.midAngle - 90) * (Math.PI / 180);
                    
                    const rBase = 90;
                    const rLineEnd = 130;
                    const rCard = 160; 

                    const xBase = Math.cos(rad) * rBase;
                    const yBase = Math.sin(rad) * rBase;

                    const xLineEnd = Math.cos(rad) * rLineEnd;
                    const yLineEnd = Math.sin(rad) * rLineEnd;

                    const xCard = Math.cos(rad) * rCard;
                    const yCard = Math.sin(rad) * rCard;

                    return (
                      <div key={`print-lbl-${op.id}`}>
                        {/* Línea señalizadora SVG independiente */}
                        <svg width="1" height="1" style={{ position: 'absolute', overflow: 'visible', zIndex: 9, left: 0, top: 0 }}>
                          <line 
                            x1={xBase} y1={yBase} 
                            x2={xLineEnd} y2={yLineEnd} 
                            stroke={op.color} strokeWidth="1.5" strokeDasharray="3,3" 
                          />
                        </svg>

                        {/* Tarjeta de información (Más separada) */}
                        <div style={{
                          position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: 'translate(-50%, -50%)',
                          backgroundColor: '#ffffff', border: `2px solid ${op.color}`, padding: '4px 8px', borderRadius: '6px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', zIndex: 10
                        }}>
                          <span style={{ fontSize: '7pt', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
                            {op.isFaltante ? 'Faltante' : `Semana ${op.semanaIndex}`}
                          </span>
                          <span style={{ fontSize: '8pt', fontWeight: 900, color: op.color }}>
                            {op.porcentajeStr}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-break"></div>

        <div className="card-print">
          <h3 className="section-executive-title" style={{marginTop:0, border: 'none'}}>Estado de Resultados Consolidado por Mes</h3>
          <table>
            <thead><tr><th>MES</th><th style={{textAlign:'right'}}>META</th><th style={{textAlign:'right'}}>VENTAS REALES</th><th style={{textAlign:'center'}}>EFECTIVIDAD</th><th style={{textAlign:'right'}}>DIFERENCIA</th><th style={{textAlign:'center'}}>ESTADO</th></tr></thead>
            <tbody>
              {reporteMensual.datosPorMes.map(f => (
                <tr key={`print-mes-${f.mes}`}>
                  <td><strong>{f.mes}</strong></td>
                  <td style={{textAlign:'right'}}>{f.meta > 0 ? miFormatearMoneda(f.meta) : '-'}</td>
                  <td style={{textAlign:'right', fontWeight:700}}>{f.ventas > 0 ? miFormatearMoneda(f.ventas) : '-'}</td>
                  <td style={{textAlign:'center'}}>{f.meta > 0 ? `${f.pctVentas.toFixed(2)}%` : '-'}</td>
                  <td style={{textAlign:'right', color: f.isExcedente ? '#10b981' : '#f56036'}}>{f.meta > 0 ? miFormatearMoneda(f.porCumplir) : '-'}</td>
                  <td style={{textAlign:'center', fontWeight:800, color: f.isExcedente ? '#10b981' : '#f56036'}}>{f.meta > 0 ? (f.isExcedente ? 'EXCEDENTE' : 'FALTANTE') : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{background:'#f8fafc'}}>
              <tr>
                <td style={{fontWeight: 900}}>TOTAL ANUAL</td>
                <td style={{textAlign:'right', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.meta)}</td>
                <td style={{textAlign:'right', color:'#1d8cf8', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.ventas)}</td>
                <td style={{textAlign:'center', fontWeight: 900}}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.ventas/reporteMensual.totales.meta)*100).toFixed(2) : 0}%</td>
                <td style={{textAlign:'right', color: reporteMensual.totales.isExcedente ? '#10b981' : '#f56036', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.porCumplir)}</td>
                <td style={{textAlign:'center', color: reporteMensual.totales.isExcedente ? '#10b981' : '#f56036', fontWeight: 900}}>{reporteMensual.totales.isExcedente ? 'EXCEDENTE TOTAL' : 'FALTANTE TOTAL'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card-print">
          <h3 className="section-executive-title" style={{marginTop:0, border: 'none'}}>Tendencia Anual de Desempeño</h3>
          <div className="chart-print-box" style={{height:'260px'}}>
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', gap: '15px', padding: '0 20px', borderBottom: '2px solid #cbd5e1', paddingTop: '20px' }}>
                {reporteMensual.datosPorMes.filter(m => m.ventas > 0).map(m => (
                  <div key={`bar-${m.mes}`} style={{ flex: 1, backgroundColor: '#1d8cf8', height: `${(m.ventas / Math.max(...reporteMensual.datosPorMes.map(x => x.ventas))) * 100}%`, borderRadius: '4px 4px 0 0', position: 'relative', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                    
                    {/* Etiquetas superior (Monto) e inferior (Mes) para gráfico de barras PDF */}
                    <div style={{ position: 'absolute', top: '-25px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                       <span style={{ fontSize: '7.5pt', fontWeight: 800, color: '#1e293b' }}>{miFormatearMoneda(m.ventas)}</span>
                    </div>
                    
                    <div style={{ position: 'absolute', bottom: '-22px', width: '100%', textAlign: 'center', fontSize: '8pt', fontWeight: 700, color: '#64748b' }}>
                      {m.mes.substring(0,3)}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

      </div>
    </>
  );
};