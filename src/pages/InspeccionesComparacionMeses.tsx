import { useState, useMemo, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { GitCompare, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

// =========================================================================
//  COMPARACIÓN DE INSPECCIONES — MES VS MES
//  Mismo diseño que el Análisis Comparativo de Taller: rejilla 2x2 con
//  tablas y gráficos dinámicos (torta / anillo / barras / líneas / mixto)
//  y conmutador 3D / 2D.
//  El mes más ANTIGUO siempre es la base y el más RECIENTE el comparado,
//  sin importar el orden en que se seleccionen: así el crecimiento o el
//  decrecimiento siempre queda con el signo correcto.
// =========================================================================

type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas' | 'mixto';

// Formato de números enteros (inspecciones)
const fmtNum = (valor: number) => (valor || 0).toLocaleString('en-US');

// Formato monetario: coma para miles y punto para decimales
const miFormatearMoneda = (valor: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor || 0).replace('$', '$ ');
};

export const InspeccionesComparacionMeses = () => {
  const contexto = useContext(AppContext);
  const { inspecciones } = useInspecciones();
  if (!contexto) return null;
  const { talleres } = contexto;

  const hoy = new Date();
  const anoActualStr = hoy.getFullYear().toString();
  const idxMesActual = hoy.getMonth();
  const idxMesPrevio = idxMesActual === 0 ? 11 : idxMesActual - 1;
  const anoPrevioStr = idxMesActual === 0 ? (hoy.getFullYear() - 1).toString() : anoActualStr;

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.map(i => i.ano.toString()));
    set.add(anoActualStr);
    return Array.from(set).sort();
  }, [inspecciones, anoActualStr]);

  // --- ORDENAR LOS TALLERES SEGÚN EL CATÁLOGO PARA EL FILTRO ---
  const talleresDisponibles = useMemo(() => {
    return [...talleres]
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map(t => t.nombre);
  }, [talleres]);

  // Filtros
  const [taller, setTaller] = useState<string>('Todos');
  const [ano1, setAno1] = useState<string>(anoPrevioStr);
  const [mes1, setMes1] = useState<string>(MESES[idxMesPrevio] ?? MESES[0]);
  const [ano2, setAno2] = useState<string>(anoActualStr);
  const [mes2, setMes2] = useState<string>(MESES[idxMesActual] ?? MESES[0]);

  // Controles Columna 1 (Izquierda)
  const [tipoGrafico1, setTipoGrafico1] = useState<TipoGrafico>('barras');
  const [is3D1, setIs3D1] = useState<boolean>(true);
  const [hoveredId1, setHoveredId1] = useState<string | null>(null);

  // Controles Columna 2 (Derecha)
  const [tipoGrafico2, setTipoGrafico2] = useState<TipoGrafico>('barras');
  const [is3D2, setIs3D2] = useState<boolean>(true);
  const [hoveredId2, setHoveredId2] = useState<string | null>(null);

  // Extracción de datos de un mes concreto (consolidado o de un solo taller)
  const generarDatosMes = (ano: string, mes: string) => {
    const regs = inspecciones.filter(
      i => i.ano.toString() === ano && i.mes === mes && (taller === 'Todos' || i.taller === taller)
    );
    const cantidad = regs.reduce((acc, i) => acc + (i.cantidad || 0), 0);
    const meta = regs.reduce((acc, i) => acc + (typeof (i as any).meta === 'number' ? (i as any).meta : 0), 0);
    const costoTotal = regs.reduce(
      (acc, i) => acc + (i.cantidad || 0) * (typeof (i as any).costo === 'number' ? (i as any).costo : 0),
      0
    );
    // Semanas del mes: 5 si algún registro del mes es de 5 semanas
    const semanas = regs.some(i => Number((i as any).semanas) >= 5) ? 5 : 4;
    return {
      ano, mes,
      etiqueta: `${mes} ${ano}`,
      cantidad, meta, costoTotal, semanas,
      promedioSemanal: semanas > 0 ? cantidad / semanas : 0,
      cumplimiento: meta > 0 ? (cantidad / meta) * 100 : null,
      tieneDatos: regs.length > 0
    };
  };

  const periodo1 = useMemo(
    () => generarDatosMes(ano1, mes1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inspecciones, taller, ano1, mes1]
  );
  const periodo2 = useMemo(
    () => generarDatosMes(ano2, mes2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inspecciones, taller, ano2, mes2]
  );

  // ============================================================================
  // ORDEN CRONOLÓGICO: el mes más ANTIGUO siempre es la base (va arriba en la
  // tabla) y el más RECIENTE se compara contra él, sin importar en qué filtro
  // los haya puesto el usuario. Así, si el mes reciente generó menos, el
  // resultado es DECRECIMIENTO aunque esté seleccionado como período base.
  // ============================================================================
  const claveMes = (a: string, m: string) => parseInt(a, 10) * 12 + Math.max(0, MESES.indexOf(m));
  const p1EsAntiguo = claveMes(ano1, mes1) <= claveMes(ano2, mes2);

  const base = p1EsAntiguo ? periodo1 : periodo2;         // mes más antiguo
  const reciente = p1EsAntiguo ? periodo2 : periodo1;     // mes más reciente

  const mismoMes = base.etiqueta === reciente.etiqueta;
  const hayDatos = base.tieneDatos || reciente.tieneDatos;
  const semanasDistintas = base.tieneDatos && reciente.tieneDatos && base.semanas !== reciente.semanas;

  // --- DATASET IZQUIERDO: realizadas vs meta de cada mes ---
  const datasetLeft = useMemo(() => {
    const totalL = base.cantidad + base.meta + reciente.cantidad + reciente.meta;
    return [
      { id: 'L1', label: `${base.mes} — Realizadas`, ventas: base.cantidad, color: '#1d8cf8' },
      { id: 'L2', label: `${base.mes} — Meta`, ventas: base.meta, color: '#00d6b4' },
      { id: 'L3', label: `${reciente.mes} — Realizadas`, ventas: reciente.cantidad, color: '#ffbc11' },
      { id: 'L4', label: `${reciente.mes} — Meta`, ventas: reciente.meta, color: '#ff8d72' }
    ].map(d => {
      const pct = totalL > 0 ? (d.ventas / totalL) * 100 : 0;
      return { ...d, pctStr: pct.toFixed(2) };
    });
  }, [base, reciente]);

  const totalLeft = datasetLeft.reduce((a, d) => a + d.ventas, 0);
  const maxLeft = Math.max(...datasetLeft.map(d => d.ventas), 1);

  // --- DATASET DERECHO: los dos meses comparados ---
  const totalAmbosPeriodos = base.cantidad + reciente.cantidad;
  const pctBase = totalAmbosPeriodos > 0 ? (base.cantidad / totalAmbosPeriodos) * 100 : 0;
  const pctReciente = totalAmbosPeriodos > 0 ? (reciente.cantidad / totalAmbosPeriodos) * 100 : 0;
  // Crecimiento REAL: cuánto cambió el mes reciente respecto al antiguo
  const crecimiento = base.cantidad > 0 ? ((reciente.cantidad - base.cantidad) / base.cantidad) * 100 : 0;
  const difAbsoluta = reciente.cantidad - base.cantidad;

  const datasetRight = useMemo(() => {
    return [
      { id: 'R1', label: base.etiqueta, ventas: base.cantidad, color: '#1d8cf8', pctStr: pctBase.toFixed(2) },
      { id: 'R2', label: reciente.etiqueta, ventas: reciente.cantidad, color: '#ff8d72', pctStr: pctReciente.toFixed(2) }
    ];
  }, [base.etiqueta, base.cantidad, pctBase, reciente.etiqueta, reciente.cantidad, pctReciente]);

  const maxTotalComparacion = Math.max(...datasetRight.map(d => d.ventas), 1);

  // Variación de una métrica entre base y reciente
  const variacion = (vBase: number, vRec: number) => {
    const dif = vRec - vBase;
    const pct = vBase > 0 ? (dif / vBase) * 100 : null;
    return { dif, pct };
  };

  // Celda de variación con icono, diferencia y porcentaje
  const celdaVariacion = (v: { dif: number; pct: number | null }, esMoneda = false, decimales = 0) => {
    if (!base.tieneDatos || !reciente.tieneDatos) {
      return <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>;
    }
    const color = v.dif > 0 ? 'var(--success)' : v.dif < 0 ? 'var(--danger)' : 'var(--text-muted)';
    const abs = Math.abs(v.dif);
    const texto = esMoneda ? miFormatearMoneda(abs) : decimales > 0 ? abs.toFixed(decimales) : fmtNum(Math.round(abs));
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color, whiteSpace: 'nowrap', justifyContent: 'flex-end' }}>
        {v.dif > 0 ? <TrendingUp size={14} /> : v.dif < 0 ? <TrendingDown size={14} /> : null}
        {v.dif > 0 ? '+' : v.dif < 0 ? '-' : ''}{texto}
        {v.pct !== null && v.dif !== 0 && (
          <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>({v.pct > 0 ? '+' : ''}{v.pct.toFixed(1)}%)</span>
        )}
      </span>
    );
  };

  const colorCumpl = (pct: number | null) => {
    if (pct === null) return 'var(--text-muted)';
    if (pct >= 100) return 'var(--success)';
    if (pct >= 70) return 'var(--primary)';
    return 'var(--danger)';
  };

  // ============================================================================
  // MOTOR DE RENDERIZADO DINÁMICO (Reutilizable para ambas columnas)
  // ============================================================================
  const renderDynamicChart = (
    data: typeof datasetRight, total: number, maxVal: number,
    tipo: TipoGrafico, is3D: boolean,
    hoveredId: string | null, setHoveredId: (id: string | null) => void,
    sufijoId: string
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
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmtNum(op.ventas)}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: op.color, whiteSpace: 'nowrap' }}>{op.pctStr}%</span>
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
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{fmtNum(op.ventas)}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color, whiteSpace: 'nowrap' }}>{op.pctStr}%</span>
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
            {is3D && <filter id={`shadow-insp-${sufijoId}`}><feDropShadow dx="0" dy="15" stdDeviation="5" floodColor="rgba(0,0,0,0.7)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3D ? `url(#shadow-insp-${sufijoId})` : 'none'} vectorEffect="non-scaling-stroke" />
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
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{fmtNum(op.ventas)}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color, whiteSpace: 'nowrap' }}>{op.pctStr}%</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 4. MIXTO (Combo Barras + Línea)
    if (tipo === 'mixto') {
      const puntosLinea = data.map((op, i) => {
        const xCenter = ((i + 0.5) * (100 / data.length));
        const y = 100 - (maxVal > 0 ? (op.ventas / maxVal) * 85 : 0);
        return `${xCenter},${y}`;
      }).join(' ');

      return (
        <div style={{ height: '240px', width: '100%', padding: '1rem', marginTop: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', transform: is3D ? 'perspective(1000px) rotateX(20deg) rotateY(-10deg)' : 'none', transformStyle: 'preserve-3d', transition: 'transform 0.6s', position: 'relative' }}>

          {/* Capa 1: Barras */}
          {data.map((op, i) => {
            const altura = maxVal > 0 ? (op.ventas / maxVal) * 85 : 0;
            const xCenter = ((i + 0.5) * (100 / data.length));
            const isHovered = hoveredId === op.id;
            const isDimmed = hoveredId !== null && !isHovered;

            return (
              <div key={`bar-${op.id}`} onMouseEnter={() => setHoveredId(op.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'absolute',
                  left: `${xCenter}%`,
                  bottom: '0',
                  transform: `translateX(-50%) ${isHovered ? 'translateY(-5px)' : 'none'}`,
                  width: `${Math.max(15, 60 / data.length)}%`,
                  height: `${altura}%`,
                  backgroundColor: op.color,
                  borderRadius: is3D ? '2px' : '4px 4px 0 0',
                  boxShadow: is3D ? `inset -5px 0 10px rgba(0,0,0,0.3), 0 10px 15px rgba(0,0,0,0.4)` : 'none',
                  backgroundImage: is3D ? 'linear-gradient(90deg, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0.2) 100%)' : 'none',
                  opacity: isDimmed ? 0.3 : 0.7,
                  transition: 'all 0.3s ease', cursor: 'pointer'
                }}
              />
            );
          })}

          {/* Capa 2: Línea SVG Overlay */}
          <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {is3D && <filter id={`shadow-mixto-insp-${sufijoId}`}><feDropShadow dx="0" dy="10" stdDeviation="4" floodColor="rgba(0,0,0,0.6)" /></filter>}
            <polyline points={puntosLinea} fill="none" stroke="var(--text-main)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter={is3D ? `url(#shadow-mixto-insp-${sufijoId})` : 'none'} vectorEffect="non-scaling-stroke" />
          </svg>

          {/* Capa 3: Puntos y Habladores */}
          {data.map((op, i) => {
            const xCenter = ((i + 0.5) * (100 / data.length));
            const y = 100 - (maxVal > 0 ? (op.ventas / maxVal) * 85 : 0);
            const isHovered = hoveredId === op.id;
            const isDimmed = hoveredId !== null && !isHovered;

            return (
              <div key={`pt-${op.id}`} onMouseEnter={() => setHoveredId(op.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'absolute', left: `${xCenter}%`, top: `${y}%`, width: '12px', height: '12px', backgroundColor: 'var(--text-main)', borderRadius: '50%',
                  transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.5)' : 'scale(1)'}`, border: `2px solid ${op.color}`,
                  boxShadow: is3D ? '0 4px 6px rgba(0,0,0,0.5)' : 'none', zIndex: isHovered ? 20 : 10, opacity: isDimmed ? 0.3 : 1, transition: 'all 0.3s ease', cursor: 'pointer'
                }}
              >
                <div style={{ position: 'absolute', top: '-35px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: isHovered ? 1 : (isDimmed ? 0 : 1), transition: 'opacity 0.2s', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none' }}>{fmtNum(op.ventas)}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: op.color, whiteSpace: 'nowrap' }}>{op.pctStr}%</span>
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
            <h2>Comparación de Meses</h2>
            <p className="page-subtitle">Inspecciones mes contra mes, incluso de años distintos</p>
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
          <label style={{ color: 'var(--primary)' }}>Mes Base (M1)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={ano1} onChange={(e) => setAno1(e.target.value)} style={{ flex: 1 }}>{anosDisponibles.map(a => <option key={`a1-${a}`} value={a}>{a}</option>)}</select>
            <select value={mes1} onChange={(e) => setMes1(e.target.value)} style={{ flex: 1 }}>
              {MESES.map(m => <option key={`m1-${m}`} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="filter-group" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
          <label style={{ color: 'var(--danger)' }}>Mes a Comparar (M2)</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select value={ano2} onChange={(e) => setAno2(e.target.value)} style={{ flex: 1 }}>{anosDisponibles.map(a => <option key={`a2-${a}`} value={a}>{a}</option>)}</select>
            <select value={mes2} onChange={(e) => setMes2(e.target.value)} style={{ flex: 1 }}>
              {MESES.map(m => <option key={`m2-${m}`} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {mismoMes ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <AlertTriangle size={48} color="var(--danger)" style={{ opacity: 0.6, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Selecciona dos meses distintos</h3>
          <p style={{ color: 'var(--text-muted)' }}>Ambos filtros apuntan a {base.etiqueta}. Cambia el mes o el año de alguno para poder comparar.</p>
        </div>
      ) : !hayDatos ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <AlertTriangle size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin inspecciones registradas</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            No hay datos de {taller === 'Todos' ? 'ningún taller' : taller} en {base.etiqueta} ni en {reciente.etiqueta}.
          </p>
        </div>
      ) : (
        <>
          {/* AVISO: meses con distinta cantidad de semanas */}
          {semanasDistintas && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)', borderLeft: '4px solid #7c3aed', borderRadius: '8px', padding: '0.8rem 1.1rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={20} color="#7c3aed" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                Estos meses tienen distinta cantidad de semanas ({base.etiqueta}: {base.semanas} · {reciente.etiqueta}: {reciente.semanas}).
                Para una comparación justa revisa la fila <strong>Promedio semanal</strong> de la tabla de detalle.
              </span>
            </div>
          )}

          {/* REJILLA PARALELA: LADO A LADO */}
          <style>{`
            .comparison-grid.comparison-grid-2x2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; align-items: stretch; }
            @media (max-width: 900px) { .comparison-grid.comparison-grid-2x2 { grid-template-columns: 1fr; } }
          `}</style>
          <div className="comparison-grid comparison-grid-2x2">

            {/* Tabla de detalle por métrica (izquierda) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', order: 1 }}>
              <div className="report-header t1">DETALLE: {base.etiqueta} VS {reciente.etiqueta}</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th style={{ textAlign: 'right' }}>{base.etiqueta}</th>
                      <th style={{ textAlign: 'right' }}>{reciente.etiqueta}</th>
                      <th style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)' }}>Variación</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong style={{ color: 'var(--text-main)' }}>Inspecciones realizadas</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{base.tieneDatos ? fmtNum(base.cantidad) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{reciente.tieneDatos ? fmtNum(reciente.cantidad) : '-'}</td>
                      <td style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)' }}>{celdaVariacion(variacion(base.cantidad, reciente.cantidad))}</td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--text-main)' }}>Meta programada</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{base.meta > 0 ? fmtNum(base.meta) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{reciente.meta > 0 ? fmtNum(reciente.meta) : '-'}</td>
                      <td style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)' }}>{celdaVariacion(variacion(base.meta, reciente.meta))}</td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--text-main)' }}>% Cumplimiento</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: colorCumpl(base.cumplimiento) }}>{base.cumplimiento === null ? '-' : `${base.cumplimiento.toFixed(1)}%`}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: colorCumpl(reciente.cumplimiento) }}>{reciente.cumplimiento === null ? '-' : `${reciente.cumplimiento.toFixed(1)}%`}</td>
                      <td style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)' }}>
                        {base.cumplimiento === null || reciente.cumplimiento === null ? (
                          <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
                        ) : (() => {
                          const d = reciente.cumplimiento - base.cumplimiento;
                          const color = d > 0 ? 'var(--success)' : d < 0 ? 'var(--danger)' : 'var(--text-muted)';
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 800, color, whiteSpace: 'nowrap' }}>
                              {d > 0 ? <TrendingUp size={14} /> : d < 0 ? <TrendingDown size={14} /> : null}
                              {d > 0 ? '+' : ''}{d.toFixed(1)} pts
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                    <tr>
                      <td><strong style={{ color: 'var(--text-main)' }}>Semanas del mes</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: base.semanas === 5 ? '#7c3aed' : 'var(--text-main)' }}>{base.tieneDatos ? `${base.semanas} sem` : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: reciente.semanas === 5 ? '#7c3aed' : 'var(--primary)' }}>{reciente.tieneDatos ? `${reciente.semanas} sem` : '-'}</td>
                      <td style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)', fontWeight: 700, color: semanasDistintas ? '#7c3aed' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {!base.tieneDatos || !reciente.tieneDatos ? '—' : semanasDistintas ? 'Distinta' : 'Igual'}
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong style={{ color: 'var(--text-main)' }}>Promedio semanal</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem' }}>Inspecciones ÷ semanas</small>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{base.tieneDatos ? base.promedioSemanal.toFixed(1) : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{reciente.tieneDatos ? reciente.promedioSemanal.toFixed(1) : '-'}</td>
                      <td style={{ textAlign: 'right', backgroundColor: 'var(--bg-highlight)' }}>{celdaVariacion(variacion(base.promedioSemanal, reciente.promedioSemanal), false, 1)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                      <td style={{ padding: '1rem' }}><strong style={{ fontSize: '1rem' }}>COSTO TOTAL</strong></td>
                      <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{base.tieneDatos ? miFormatearMoneda(base.costoTotal) : '-'}</td>
                      <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--success)', whiteSpace: 'nowrap' }}>{reciente.tieneDatos ? miFormatearMoneda(reciente.costoTotal) : '-'}</td>
                      <td style={{ textAlign: 'right', padding: '1rem' }}>{celdaVariacion(variacion(base.costoTotal, reciente.costoTotal), true)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Tabla comparación (M1 vs M2) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', order: 2 }}>
              <div className="report-header" style={{ borderTop: '3px solid var(--text-muted)' }}>
                CRECIMIENTO: {base.etiqueta} VS {reciente.etiqueta}
              </div>
              <table className="table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Mes Analizado</th>
                    <th style={{ textAlign: 'right' }}>Inspecciones</th>
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
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.ventas > 0 ? fmtNum(d.ventas) : '-'}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{d.pctStr}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}><strong style={{ fontSize: '1rem' }}>TOTAL COMPARADO</strong></td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtNum(totalAmbosPeriodos)}</td>
                    <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 700 }}>{totalAmbosPeriodos > 0 ? '100.00%' : '0.00%'}</td>
                  </tr>
                  {/* CRECIMIENTO / DECRECIMIENTO: diferencia entre el mes reciente y el base */}
                  <tr style={{ backgroundColor: crecimiento >= 0 ? 'rgba(0, 214, 180, 0.08)' : 'rgba(255, 141, 114, 0.08)', borderTop: `2px solid ${crecimiento >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {crecimiento >= 0 ? <TrendingUp size={18} color="var(--success)" /> : <TrendingDown size={18} color="var(--danger)" />}
                        <strong style={{ fontSize: '1rem', color: crecimiento >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {crecimiento >= 0 ? 'CRECIMIENTO' : 'DECRECIMIENTO'}
                        </strong>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 800, color: crecimiento >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {difAbsoluta >= 0 ? '+' : '-'}{fmtNum(Math.abs(difAbsoluta))}
                    </td>
                    <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 800, color: crecimiento >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                      {crecimiento > 0 ? '+' : ''}{crecimiento.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Gráfico: realizadas vs meta de ambos meses (izquierda) */}
            <div className="card" style={{ order: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <h3 className="detail-section-title" style={{ border: 'none', margin: 0 }}>Realizadas vs Meta</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select value={tipoGrafico1} onChange={(e) => setTipoGrafico1(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}>
                    <option value="barras">Barras</option>
                    <option value="torta">Torta</option>
                    <option value="anillo">Anillo</option>
                    <option value="lineas">Líneas</option>
                    <option value="mixto">Mixto (Combo)</option>
                  </select>
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: is3D1 ? 'var(--primary)' : 'transparent', color: is3D1 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D1(true)}>3D</button>
                    <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: !is3D1 ? 'var(--primary)' : 'transparent', color: !is3D1 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D1(false)}>2D</button>
                  </div>
                </div>
              </div>

              {renderDynamicChart(datasetLeft, totalLeft, maxLeft, tipoGrafico1, is3D1, hoveredId1, setHoveredId1, 'left')}

              <ul className="legend-below-chart-list">
                {datasetLeft.map(d => (
                  <li key={`leg-${d.id}`} onMouseEnter={() => setHoveredId1(d.id)} onMouseLeave={() => setHoveredId1(null)}
                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: hoveredId1 === d.id ? 'var(--sidebar-hover)' : 'transparent', padding: '0.4rem 0.75rem', borderRadius: '6px', cursor: 'pointer', opacity: hoveredId1 !== null && hoveredId1 !== d.id ? 0.4 : 1, transition: 'all 0.2s' }}>
                    <span className="custom-color-bullet" style={{ backgroundColor: d.color, color: d.color }}></span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center', gap: '0.75rem' }}>
                      <span>{d.label}</span>
                      <strong style={{ color: 'var(--text-main)', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtNum(d.ventas)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Gráfico comparación (M1 vs M2) */}
            <div className="card" style={{ order: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.1rem', borderRadius: '24px', fontWeight: 800, fontSize: '1.05rem',
                    backgroundColor: crecimiento >= 0 ? 'rgba(0, 214, 180, 0.15)' : 'rgba(255, 141, 114, 0.15)', color: crecimiento >= 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {crecimiento >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    {crecimiento > 0 ? '+' : ''}{crecimiento.toFixed(2)}%
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select value={tipoGrafico2} onChange={(e) => setTipoGrafico2(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}>
                    <option value="barras">Barras</option>
                    <option value="torta">Torta</option>
                    <option value="anillo">Anillo</option>
                    <option value="lineas">Líneas</option>
                    <option value="mixto">Mixto (Combo)</option>
                  </select>
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: is3D2 ? 'var(--primary)' : 'transparent', color: is3D2 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D2(true)}>3D</button>
                    <button style={{ padding: '0.3rem 0.6rem', border: 'none', background: !is3D2 ? 'var(--primary)' : 'transparent', color: !is3D2 ? 'white' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => setIs3D2(false)}>2D</button>
                  </div>
                </div>
              </div>

              {renderDynamicChart(datasetRight, totalAmbosPeriodos, maxTotalComparacion, tipoGrafico2, is3D2, hoveredId2, setHoveredId2, 'right')}

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
        </>
      )}
    </div>
  );
};