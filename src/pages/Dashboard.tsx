import { useState, useMemo, useContext, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useMetasAnuales } from '../hooks/useMetasAnuales';
import { useSemanasEditadas } from '../hooks/useSemanasEditadas';
import { TextoEditable } from '../components/TextoEditable';
import { PieChart as PieIcon, Target, TrendingUp, AlertTriangle, Printer, Filter, Download, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

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
  // Usamos \u00A0 (Non-breaking space) para evitar que el $ se separe del número.
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor).replace('$', '$\u00A0');
};


export const Dashboard = () => {
  const contexto = useContext(AppContext);
  // Metas anuales por taller (compartidas en Firestore)
  const { metasAnuales, obtenerMetaAnual, totalMetaAnualDelAno } = useMetasAnuales();
  if (!contexto) return null;
  const { registros, talleres } = contexto;

  // Estados de Filtro
  const [filtroAno, setFiltroAno] = useState<string>('Todos');
  const [filtroMes, setFiltroMes] = useState<string>('Todos');
  const [filtroTaller, setFiltroTaller] = useState<string>('Todos');

  // Validación de filtros completos
  const filtrosCompletos = filtroAno !== 'Todos' && filtroMes !== 'Todos' && filtroTaller !== 'Todos';

  // Estados de Control del Gráfico Superior (Operaciones)
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('anillo');
  const [is3D, setIs3D] = useState<boolean>(true);
  const [hoveredOp, setHoveredOp] = useState<string | null>(null);

  // Estados de Control del Gráfico Inferior (Mensual)
  const [tipoGraficoMensual, setTipoGraficoMensual] = useState<TipoGrafico>('barras');
  const [is3DMensual, setIs3DMensual] = useState<boolean>(true);
  const [hoveredMes, setHoveredMes] = useState<string | null>(null);

  // --- NUEVO: Estado y referencia para exportar el reporte como IMAGEN PNG ---
  const reporteImagenRef = useRef<HTMLDivElement>(null);
  const [generandoImagen, setGenerandoImagen] = useState<boolean>(false);

  // --- NUEVO: PDF EJECUTIVO (una diapositiva horizontal por taller) ---
  const [generandoPDF, setGenerandoPDF] = useState<boolean>(false);
  const [slidesPDF, setSlidesPDF] = useState<any[]>([]);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // --- NUEVO: AJUSTE DEL PDF ANTES DE DESCARGAR (siempre horizontal, sin salirse de la hoja) ---
  const [mostrarAjustePDF, setMostrarAjustePDF] = useState<boolean>(false);
  const [accionPDF, setAccionPDF] = useState<'print' | 'ejecutivo' | null>(null);
  const [escalaPDF, setEscalaPDF] = useState<number>(100); // % del tamaño del contenido dentro de la hoja

  const abrirAjustePDF = (accion: 'print' | 'ejecutivo') => {
    setAccionPDF(accion);
    setMostrarAjustePDF(true);
  };

  const confirmarPDF = () => {
    setMostrarAjustePDF(false);
    if (accionPDF === 'ejecutivo') {
      generarPDFEjecutivo();
    } else if (accionPDF === 'print') {
      // pequeño delay para que el modal se cierre antes del diálogo de impresión
      setTimeout(() => window.print(), 180);
    }
    setAccionPDF(null);
  };

  // --- Semanas editables y persistentes (por Año + Taller + Mes) ---
  // Se guardan en Firestore (config/semanasEditadas) para que la edición se
  // conserve y se comparta entre usuarios y equipos, no solo en este navegador.
  const { semanasEditadas, guardarSemanas: persistirSemanas } = useSemanasEditadas();

  // Las semanas del mes son iguales para TODOS los talleres: la clave depende
  // solo del año y del mes, no del taller. Así se captura una sola vez.
  const claveSemana = (mes: string) => `${filtroAno}__${mes}`;

  const getSemanas = (mes: string, computado: number) => {
    const k = claveSemana(mes);
    return semanasEditadas[k] !== undefined ? semanasEditadas[k] : computado;
  };

  const guardarSemanas = (mes: string, valor: number) => {
    persistirSemanas(claveSemana(mes), valor);
  };

  // Fecha actual para el reporte PDF (Forzada a MM/DD/YYYY local)
  const fechaReporte = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  // Listas únicas para selectores
  const anosDisponibles = useMemo(() => Array.from(new Set(registros.map(r => r.ano.toString()))).sort(), [registros]);

  // --- META ANUAL DEL AÑO: suma de las metas mensuales del año ---
  // Coincide con la fila Total del Reporte Mensual Consolidado. La meta anual del
  // catálogo se conserva solo como referencia informativa (esEstablecida).
  const resumenMetaAnual = useMemo(() => {
    const ano = filtroAno !== 'Todos' ? filtroAno : String(new Date().getFullYear());
    const regs = registros.filter(r =>
      r.ano.toString() === ano && (filtroTaller === 'Todos' || r.taller === filtroTaller)
    );
    // La meta anual es la SUMA DE LAS METAS MENSUALES del año, para que
    // coincida exactamente con la fila Total del Reporte Mensual Consolidado.
    const sumaMensual = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
    const establecida = filtroTaller === 'Todos'
      ? totalMetaAnualDelAno('ventas', ano)
      : obtenerMetaAnual('ventas', ano, filtroTaller);
    const metaAnual = sumaMensual;
    const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
    const faltante = Math.max(metaAnual - logrado, 0);
    const pct = metaAnual > 0 ? (logrado / metaAnual) * 100 : 0;
    return {
      ano, metaAnual, sumaMensual, logrado, faltante, pct,
      pctFaltante: Math.max(100 - pct, 0),
      esEstablecida: establecida > 0,
      tieneDatos: regs.length > 0 || establecida > 0
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, filtroAno, filtroTaller, metasAnuales]);



  // =========================================================================
  //  GRÁFICA DE RELOJ (GAUGE) DE ALCANCE DE LA META ANUAL
  //  Semicírculo de 180°: el tramo alcanzado va en verde y el faltante en
  //  rojo, con una aguja que apunta al porcentaje actual.
  // =========================================================================
  const renderGaugeMeta = (pctCrudo: number) => {
    const pct = Math.max(0, Math.min(pctCrudo, 100)); // la aguja no pasa del 100%
    const W = 420, H = 300;
    const cx = W / 2, cy = 214;      // centro de giro de la aguja
    const rExt = 160, rInt = 112;    // radios del arco

    // Ángulo en grados (180 = izquierda, 0 = derecha) -> punto cartesiano
    const punto = (angGrados: number, radio: number) => {
      const rad = (angGrados * Math.PI) / 180;
      return { x: cx + radio * Math.cos(rad), y: cy - radio * Math.sin(rad) };
    };

    // Sector del anillo entre dos porcentajes (0..100)
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

        {/* Marcas cada 5%: mayores en 0/25/50/75/100 */}
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

        {/* Etiquetas de la escala */}
        <text x={cx - rExt - 4} y={cy + 20} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">0%</text>
        <text x={cx} y={cy - rExt - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">50%</text>
        <text x={cx + rExt + 4} y={cy + 20} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--text-muted)">100%</text>

        {/* AGUJA */}
        <line x1={cx} y1={cy} x2={puntaAguja.x} y2={puntaAguja.y} stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="15" fill="var(--bg-panel)" stroke="#f1f5f9" strokeWidth="5" />

        {/* PORCENTAJE: debajo de la aguja, en blanco */}
        <text x={cx} y={cy + 58} textAnchor="middle" fontSize="42" fontWeight="900" fill="#ffffff">{pctCrudo.toFixed(2)}%</text>
        <text x={cx} y={cy + 78} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--text-muted)" letterSpacing="1.5">ALCANCE ACTUAL</text>
      </svg>
    );
  };
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

  // Cálculos de KPIs Agregados (CON LÓGICA DE EXCEDENTE Y PORCENTAJES REALES)
  const kpis = useMemo(() => {
    const metaTotal = registrosFiltrados.reduce((acc, r) => acc + r.meta, 0);
    const logradoTotal = registrosFiltrados.reduce((acc, r) => acc + r.logrado, 0);
    const isExcedente = logradoTotal > metaTotal;
    const faltanteTotal = isExcedente ? logradoTotal - metaTotal : Math.max(metaTotal - logradoTotal, 0);
    const porcentajeGlobal = metaTotal > 0 ? Number(((logradoTotal / metaTotal) * 100).toFixed(2)) : 0;
    const porcentajeFaltanteExcedente = metaTotal > 0 ? Number(((faltanteTotal / metaTotal) * 100).toFixed(2)) : 0;
    
    return { metaTotal, logradoTotal, faltanteTotal, porcentajeGlobal, isExcedente, porcentajeFaltanteExcedente };
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
      const numSemanas = registrosMes.reduce((acc, r) => acc + (r.detalles ? r.detalles.length : 0), 0);
      const isExcedente = ventas > meta;
      const porCumplir = isExcedente ? ventas - meta : Math.max(meta - ventas, 0);
      return { 
        mes, 
        meta, 
        ventas, 
        numSemanas,
        pctVentas: meta > 0 ? (ventas / meta) * 100 : 0, 
        porCumplir,
        isExcedente,
        pctPorCumplir: meta > 0 ? (porCumplir / meta) * 100 : 0 
      };
    });
    const totales = { 
      meta: datosPorMes.reduce((acc, m) => acc + m.meta, 0), 
      ventas: datosPorMes.reduce((acc, m) => acc + m.ventas, 0),
      numSemanas: datosPorMes.reduce((acc, m) => acc + m.numSemanas, 0)
    };
    return { datosPorMes, totales: { ...totales, porCumplir: Math.abs(totales.meta - totales.ventas), isExcedente: totales.ventas > totales.meta } };
  }, [registros, filtroAno, filtroTaller]);

  // Total de semanas mostrado considerando las ediciones manuales
  const totalSemanasMostrado = useMemo(() => {
    return reporteMensual.datosPorMes.reduce((acc, m) => acc + getSemanas(m.mes, m.numSemanas), 0);
  }, [reporteMensual, semanasEditadas, filtroAno]);

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

  // --- RENDERIZADOR GRÁFICO SUPERIOR ---
  const renderGrafico = () => {
    if (!analisisOperaciones) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos para graficar.</p>;
    const { operaciones, gradient } = analisisOperaciones;
    const maxVendido = Math.max(...operaciones.map(o => o.vendido));

    if (tipoGrafico === 'torta' || tipoGrafico === 'anillo') {
      const mascaraDonut = tipoGrafico === 'anillo' ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';
      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: is3D ? '1.5rem auto 4rem auto' : '2rem 0 3rem 0', width: '100%', height: '470px' }}>
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
            {operaciones.map((op, index) => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              
              // 1) PUNTO BASE: cae exactamente sobre el borde del anillo, para que
              //    el círculo y la línea guía lo toquen (radio real del anillo).
              const rAnillo = is3D ? 125 : 120;

              let xBase = Math.cos(rad) * rAnillo;
              let yBase = Math.sin(rad) * rAnillo;

              if (is3D) {
                const angle15 = 15 * (Math.PI / 180);
                const cos15 = Math.cos(angle15);
                const sin15 = Math.sin(angle15);
                const apply3D = (x: number, y: number) => {
                  const xRot = x * cos15 - y * sin15;
                  const yRot = x * sin15 + y * cos15;
                  return { x: xRot, y: (yRot * 0.5) + 15 };
                };
                const base3d = apply3D(xBase, yBase);
                xBase = base3d.x; yBase = base3d.y;
              }

              // 2) TARJETA: se coloca alejándose en línea recta desde el centro
              //    hacia el punto base, a una distancia fija MÁS ALLÁ del anillo.
              //    Así la viñeta guarda su holgura y la línea siempre queda radial.
              const cxProy = 0;
              const cyProy = is3D ? 15 : 0; // centro del anillo ya proyectado
              const dx = xBase - cxProy;
              const dy = yBase - cyProy;
              const distBase = Math.hypot(dx, dy) || 1;
              // Separación de la viñeta respecto al borde del anillo (alternada
              // para escalonar las tarjetas y que no choquen entre sí)
              const separacion = 92 + (index % 2 === 0 ? 0 : 42);
              const distCard = distBase + separacion;

              const xCard = cxProy + (dx / distBase) * distCard;
              const yCard = cyProy + (dy / distBase) * distCard;

              const isHovered = hoveredOp === op.id;
              const isDimmed = hoveredOp !== null && !isHovered;

              return (
                <div key={`hablador-${op.id}`}>
                  <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', zIndex: 90, pointerEvents: 'none', opacity: isHovered ? 1 : 0.4 }}>
                    <line x1={xBase} y1={yBase} x2={xCard} y2={yCard} stroke={op.color} strokeWidth={isHovered ? "3" : "1.5"} strokeDasharray="4,3" />
                    <circle cx={xBase} cy={yBase} r="5" fill={op.color} />
                  </svg>
                  
                  <div onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)}
                    style={{ position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`, backgroundColor: 'var(--bg-panel)', border: `2px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px', boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100, opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
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
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3D ? '0 2px 4px rgba(0,0,0,0.8)' : 'none', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
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

  // --- RENDERIZADOR GRÁFICO INFERIOR (WEB) ---
  const renderGraficoMensual = () => {
    if (!datosGraficoMensual) return <p className="detail-text" style={{ textAlign: 'center', padding: '3rem', fontStyle: 'italic' }}>Sin datos mensuales para graficar.</p>;
    const { operaciones, gradient } = datosGraficoMensual;
    const maxVendido = Math.max(...operaciones.map(o => o.vendido));

    if (tipoGraficoMensual === 'torta' || tipoGraficoMensual === 'anillo') {
      const mascaraDonut = tipoGraficoMensual === 'anillo' ? 'radial-gradient(circle, transparent 40%, black 41%)' : 'none';
      return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: is3DMensual ? '1.5rem auto 4rem auto' : '2rem 0 3rem 0', width: '100%', height: '470px' }}>
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
            {operaciones.map((op, index) => {
              const rad = (op.midAngle - 90) * (Math.PI / 180);
              
              // 1) PUNTO BASE: cae exactamente sobre el borde del anillo, para que
              //    el círculo y la línea guía lo toquen (radio real del anillo).
              const rAnillo = is3DMensual ? 125 : 120;

              let xBase = Math.cos(rad) * rAnillo;
              let yBase = Math.sin(rad) * rAnillo;

              if (is3DMensual) {
                const angle15 = 15 * (Math.PI / 180);
                const cos15 = Math.cos(angle15);
                const sin15 = Math.sin(angle15);
                const apply3D = (x: number, y: number) => {
                  const xRot = x * cos15 - y * sin15;
                  const yRot = x * sin15 + y * cos15;
                  return { x: xRot, y: (yRot * 0.5) + 15 };
                };
                const base3d = apply3D(xBase, yBase);
                xBase = base3d.x; yBase = base3d.y;
              }

              // 2) TARJETA: se coloca alejándose en línea recta desde el centro
              //    hacia el punto base, a una distancia fija MÁS ALLÁ del anillo.
              //    Así la viñeta guarda su holgura y la línea siempre queda radial.
              const cxProy = 0;
              const cyProy = is3DMensual ? 15 : 0; // centro del anillo ya proyectado
              const dx = xBase - cxProy;
              const dy = yBase - cyProy;
              const distBase = Math.hypot(dx, dy) || 1;
              // Separación de la viñeta respecto al borde del anillo (alternada
              // para escalonar las tarjetas y que no choquen entre sí)
              const separacion = 92 + (index % 2 === 0 ? 0 : 42);
              const distCard = distBase + separacion;

              const xCard = cxProy + (dx / distBase) * distCard;
              const yCard = cyProy + (dy / distBase) * distCard;

              const isHovered = hoveredMes === op.id;
              const isDimmed = hoveredMes !== null && !isHovered;

              return (
                <div key={`hablador-mes-${op.id}`}>
                  <svg style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', zIndex: 90, pointerEvents: 'none', opacity: isHovered ? 1 : 0.4 }}>
                    <line x1={xBase} y1={yBase} x2={xCard} y2={yCard} stroke={op.color} strokeWidth={isHovered ? "3" : "1.5"} strokeDasharray="4,3" />
                    <circle cx={xBase} cy={yBase} r="5" fill={op.color} />
                  </svg>
                  
                  <div onMouseEnter={() => setHoveredMes(op.id)} onMouseLeave={() => setHoveredMes(null)}
                    style={{ position: 'absolute', left: `${xCard}px`, top: `${yCard}px`, transform: `translate(-50%, -50%) ${isHovered ? 'scale(1.1)' : 'scale(1)'}`, backgroundColor: 'var(--bg-panel)', border: `2px solid ${op.color}`, padding: '0.4rem 0.6rem', borderRadius: '6px', boxShadow: isHovered ? `0 4px 15px ${op.color}40` : '0 4px 10px rgba(0,0,0,0.4)', zIndex: isHovered ? 110 : 100, opacity: isDimmed ? 0.15 : 1, transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
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
                   <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', textShadow: is3DMensual ? '0 2px 4px rgba(0,0,0,0.8)' : 'none', whiteSpace: 'nowrap' }}>{miFormatearMoneda(op.vendido)}</span>
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

  // Datos preparados para la gráfica de tendencia del PDF (contenida, sin desborde)
  const tendenciaPDF = reporteMensual.datosPorMes.filter(m => m.ventas > 0);
  const maxTendenciaPDF = Math.max(...tendenciaPDF.map(m => m.ventas), 1);

  // --- DIARIO / SEMANAL para el PDF (mismos valores guardados que usa la imagen) ---
  // Semanal = lo guardado o Meta/4 ; Diario = lo guardado o Semanal/6 (respaldo para registros antiguos)
  const semanalIndicador = registrosFiltrados.reduce(
    (acc, r) => acc + (typeof r.semanal === 'number' ? r.semanal : (r.meta > 0 ? r.meta / 4 : 0)),
    0
  );
  const diarioIndicador = registrosFiltrados.reduce(
    (acc, r) => acc + (typeof r.diario === 'number' ? r.diario : (r.meta > 0 ? (r.meta / 4) / 6 : 0)),
    0
  );

  // Indicador de crecimiento / disminución con símbolo y signo (ej: "📈 +12%" / "📉 -8%")
  const signoTendencia = kpis.isExcedente
    ? `📈 +${kpis.porcentajeFaltanteExcedente}%`
    : `📉 -${kpis.porcentajeFaltanteExcedente}%`;

  // =========================================================================
  // NUEVO: DATOS Y UTILIDADES PARA EL REPORTE DE IMAGEN (estilo planilla, más PRO)
  // =========================================================================

  // Helpers para dibujar sectores de PIE en SVG (sin librerías externas)
  const polarToCartesian = (cx: number, cy: number, r: number, anguloGrados: number) => {
    const a = ((anguloGrados - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const arcoPie = (cx: number, cy: number, r: number, anguloInicio: number, anguloFin: number) => {
    const ini = polarToCartesian(cx, cy, r, anguloFin);
    const fin = polarToCartesian(cx, cy, r, anguloInicio);
    const largeArc = anguloFin - anguloInicio <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${ini.x} ${ini.y} A ${r} ${r} 0 ${largeArc} 0 ${fin.x} ${fin.y} Z`;
  };

  // Cálculo de toda la información mostrada en la imagen del reporte
  const datosReporteImagen = useMemo(() => {
    if (!analisisOperaciones) return null;

    // Solo operaciones reales (excluimos la barra "faltante" del gráfico)
    const reales = analisisOperaciones.operaciones.filter(o => !o.isFaltante);
    const numSemanas = reales.length;

    // --- CAMBIO: SEMANAL y DIARIO ahora se toman EXACTAMENTE de lo guardado en el formulario.
    // Cada registro guarda su meta semanal y diaria; aquí las sumamos (normalmente hay 1 registro
    // por Año+Mes+Taller). Si un registro antiguo no las tiene, se calculan como respaldo
    // (Semanal = Meta/4 ; Diario = Semanal/6) para no romper datos previos.
    const semanal = registrosFiltrados.reduce(
      (acc, r) => acc + (typeof r.semanal === 'number' ? r.semanal : (r.meta > 0 ? r.meta / 4 : 0)),
      0
    );
    const diario = registrosFiltrados.reduce(
      (acc, r) => acc + (typeof r.diario === 'number' ? r.diario : (r.meta > 0 ? (r.meta / 4) / 6 : 0)),
      0
    );

    // Rango de fechas: desde la primera operación hasta la última
    const primera = reales[0];
    const ultima = reales[reales.length - 1];
    const rangoDesde = primera ? miFormatearFecha(primera.desde) : '-';
    const rangoHasta = ultima ? miFormatearFecha(ultima.hasta) : '-';

    // Filas de la tabla (periodo + monto + % sobre la meta)
    const filas = reales.map((op, i) => ({
      id: op.id,
      idx: i + 1,
      periodo: `${miFormatearFecha(op.desde)} AL ${miFormatearFecha(op.hasta)}`,
      vendido: op.vendido,
      color: op.color,
      pctMeta: kpis.metaTotal > 0 ? (op.vendido / kpis.metaTotal) * 100 : 0,
    }));

    // Segmentos del PIE (participación de cada semana sobre el total vendido)
    const totalReal = reales.reduce((acc, o) => acc + o.vendido, 0);
    let acumulado = 0;
    const segmentosPie = reales.map((op, i) => {
      const frac = totalReal > 0 ? op.vendido / totalReal : 0;
      const inicio = acumulado * 360;
      acumulado += frac;
      const fin = acumulado * 360;
      return {
        id: op.id,
        idx: i + 1,
        color: op.color,
        vendido: op.vendido,
        pct: frac * 100,
        inicio,
        fin,
        path: arcoPie(110, 110, 95, inicio, fin),
      };
    });

    return { reales, numSemanas, semanal, diario, rangoDesde, rangoHasta, filas, segmentosPie, totalReal };
  }, [analisisOperaciones, kpis, registrosFiltrados]);

  // =========================================================================
  // ANILLO DE CUMPLIMIENTO (compartido por la imagen y el PDF):
  //   - cada semana se pinta con su color
  //   - el FALTANTE (lo que no se alcanzó de la meta) se pinta en ROJO
  //   - el SOBRANTE (lo vendido por encima de la meta) se pinta en VERDE
  // El círculo completo representa max(meta, vendido). Cuando hay sobrante,
  // las semanas llenan hasta la meta y el excedente se corta en verde.
  // =========================================================================
  const COLOR_FALTANTE = '#ef4444'; // rojo
  const COLOR_SOBRANTE = '#22c55e'; // verde

  const segmentosMeta = useMemo(() => {
    if (!analisisOperaciones) return null;

    const meta = kpis.metaTotal;
    const reales = analisisOperaciones.operaciones.filter(o => !o.isFaltante);
    const vendido = reales.reduce((a, o) => a + o.vendido, 0);
    const base = Math.max(meta, vendido) || 1;

    const segmentos: any[] = [];
    let acc = 0;
    reales.forEach((op, i) => {
      const start = acc;
      const end = acc + op.vendido;
      acc = end;
      if (vendido <= meta) {
        // No se superó la meta: cada semana se pinta completa con su color
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido, from: start, to: end });
      } else if (start >= meta) {
        // Semana totalmente por encima de la meta -> sobrante (verde)
        segmentos.push({ id: `sob-${op.id}`, idx: i + 1, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: op.vendido, from: start, to: end });
      } else if (end <= meta) {
        // Semana totalmente dentro de la meta -> color de semana
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido, from: start, to: end });
      } else {
        // La semana cruza la meta: una parte semana, el resto sobrante (verde)
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: meta - start, from: start, to: meta });
        segmentos.push({ id: `sob-${op.id}`, idx: i + 1, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: end - meta, from: meta, to: end });
      }
    });

    const faltante = Math.max(meta - vendido, 0);
    const sobrante = Math.max(vendido - meta, 0);

    // Si no se alcanzó la meta, el hueco restante es el faltante (rojo)
    if (faltante > 0) {
      segmentos.push({ id: 'faltante', idx: 0, tipo: 'faltante', color: COLOR_FALTANTE, valor: faltante, from: vendido, to: meta });
    }

    const segs = segmentos.map(s => {
      const pct = (s.valor / base) * 100;
      const inicio = (s.from / base) * 360;
      const fin = (s.to / base) * 360;
      return { ...s, pct, porcentajeStr: pct.toFixed(2), inicio, fin, path: arcoPie(110, 110, 95, inicio, fin) };
    });

    // Leyenda agregada: semanas + UNA entrada de faltante/sobrante
    const leyenda: any[] = reales.map((op, i) => ({
      id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido,
      pct: base > 0 ? (op.vendido / base) * 100 : 0,
    }));
    if (faltante > 0) leyenda.push({ id: 'faltante', idx: 0, tipo: 'faltante', color: COLOR_FALTANTE, valor: faltante, pct: (faltante / base) * 100 });
    if (sobrante > 0) leyenda.push({ id: 'sobrante', idx: 0, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: sobrante, pct: (sobrante / base) * 100 });

    return { segs, leyenda, meta, vendido, base, faltante, sobrante };
  }, [analisisOperaciones, kpis]);

  // Carga dinámica de html2canvas desde CDN (no requiere instalarlo en package.json)
  const cargarHtml2Canvas = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.html2canvas) return resolve(w.html2canvas);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).html2canvas);
      script.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
      document.body.appendChild(script);
    });
  };

  // Carga dinámica de jsPDF desde CDN (no requiere instalarlo en package.json)
  const cargarJsPDF = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const w = window as any;
      if (w.jspdf) return resolve(w.jspdf);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.async = true;
      script.onload = () => resolve((window as any).jspdf);
      script.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
      document.body.appendChild(script);
    });
  };

  // =========================================================================
  // NUEVO: cálculo de TODOS los datos de un taller (versión "pura", sin hooks)
  // para poder generar UNA diapositiva por taller dentro del PDF ejecutivo.
  // Replica exactamente la lógica de kpis + analisisOperaciones + datosReporteImagen
  // + segmentosMeta, pero recibiendo los registros de un solo taller.
  // =========================================================================
  const calcularDatosTaller = (regs: any[]) => {
    const metaTotal = regs.reduce((a, r) => a + r.meta, 0);
    const logradoTotal = regs.reduce((a, r) => a + r.logrado, 0);
    const isExcedente = logradoTotal > metaTotal;
    const faltanteTotal = isExcedente ? logradoTotal - metaTotal : Math.max(metaTotal - logradoTotal, 0);
    const porcentajeGlobal = metaTotal > 0 ? Number(((logradoTotal / metaTotal) * 100).toFixed(2)) : 0;
    const porcentajeFaltanteExcedente = metaTotal > 0 ? Number(((faltanteTotal / metaTotal) * 100).toFixed(2)) : 0;

    const colores = ['#1d8cf8', '#00d6b4', '#ffbc11', '#d048b6', '#51cbce', '#8965e0', '#2dce89'];
    const listaOperaciones = regs.flatMap(r => (r.detalles || []).map((d: any) => ({ ...d, tallerPadre: r.taller })));
    const totalVendido = listaOperaciones.reduce((a: number, o: any) => a + o.vendido, 0);

    const weeks = listaOperaciones.map((op: any, i: number) => ({ ...op, color: colores[i % colores.length], idx: i + 1 }));

    const excedenteObj = totalVendido > metaTotal
      ? { valor: totalVendido - metaTotal, porcentaje: metaTotal > 0 ? ((totalVendido - metaTotal) / metaTotal) * 100 : 100 }
      : null;

    const semanal = regs.reduce((a, r) => a + (typeof r.semanal === 'number' ? r.semanal : (r.meta > 0 ? r.meta / 4 : 0)), 0);
    const diario = regs.reduce((a, r) => a + (typeof r.diario === 'number' ? r.diario : (r.meta > 0 ? (r.meta / 4) / 6 : 0)), 0);

    const primera = weeks[0];
    const ultima = weeks[weeks.length - 1];
    const rangoDesde = primera ? miFormatearFecha(primera.desde) : '-';
    const rangoHasta = ultima ? miFormatearFecha(ultima.hasta) : '-';

    const filas = weeks.map((op: any, i: number) => ({
      id: op.id, idx: i + 1,
      periodo: `${miFormatearFecha(op.desde)} AL ${miFormatearFecha(op.hasta)}`,
      vendido: op.vendido, color: op.color,
      pctMeta: metaTotal > 0 ? (op.vendido / metaTotal) * 100 : 0,
    }));

    // ----- Anillo de cumplimiento (mismo corte semana/faltante/sobrante) -----
    const meta = metaTotal;
    const vendido = totalVendido;
    const base = Math.max(meta, vendido) || 1;
    const segmentos: any[] = [];
    let acc = 0;
    weeks.forEach((op: any, i: number) => {
      const start = acc;
      const end = acc + op.vendido;
      acc = end;
      if (vendido <= meta) {
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido, from: start, to: end });
      } else if (start >= meta) {
        segmentos.push({ id: `sob-${op.id}`, idx: i + 1, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: op.vendido, from: start, to: end });
      } else if (end <= meta) {
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido, from: start, to: end });
      } else {
        segmentos.push({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: meta - start, from: start, to: meta });
        segmentos.push({ id: `sob-${op.id}`, idx: i + 1, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: end - meta, from: meta, to: end });
      }
    });
    const faltante = Math.max(meta - vendido, 0);
    const sobrante = Math.max(vendido - meta, 0);
    if (faltante > 0) segmentos.push({ id: 'faltante', idx: 0, tipo: 'faltante', color: COLOR_FALTANTE, valor: faltante, from: vendido, to: meta });

    const segs = segmentos.map(s => {
      const pct = (s.valor / base) * 100;
      const inicio = (s.from / base) * 360;
      const fin = (s.to / base) * 360;
      return { ...s, pct, porcentajeStr: pct.toFixed(2), inicio, fin, path: arcoPie(110, 110, 95, inicio, fin) };
    });
    const leyenda: any[] = weeks.map((op: any, i: number) => ({ id: op.id, idx: i + 1, tipo: 'semana', color: op.color, valor: op.vendido, pct: base > 0 ? (op.vendido / base) * 100 : 0 }));
    if (faltante > 0) leyenda.push({ id: 'faltante', idx: 0, tipo: 'faltante', color: COLOR_FALTANTE, valor: faltante, pct: (faltante / base) * 100 });
    if (sobrante > 0) leyenda.push({ id: 'sobrante', idx: 0, tipo: 'sobrante', color: COLOR_SOBRANTE, valor: sobrante, pct: (sobrante / base) * 100 });

    return {
      kpis: { metaTotal, logradoTotal, faltanteTotal, porcentajeGlobal, isExcedente, porcentajeFaltanteExcedente },
      weeks, excedenteObj, diario, semanal, rangoDesde, rangoHasta, filas, totalVendido,
      segmentosMeta: { segs, leyenda, meta, vendido, base, faltante, sobrante },
    };
  };

  // Arma la lista de diapositivas (un taller por hoja) para el Año+Mes seleccionados
  const generarPDFEjecutivo = () => {
    const talleresOrdenados = [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const lista = talleresOrdenados
      .map(t => {
        const regs = registros.filter(r => r.ano.toString() === filtroAno && r.mes === filtroMes && r.taller === t.nombre);
        return { taller: t, registros: regs };
      })
      .filter(x => x.registros.length > 0) // solo talleres con datos en el período
      .map(x => ({ taller: x.taller, datos: calcularDatosTaller(x.registros) }));

    if (lista.length === 0) {
      alert('No hay talleres con información para el mes y año seleccionados.');
      return;
    }
    setSlidesPDF(lista);
    setGenerandoPDF(true);
  };

  // Cuando las diapositivas están montadas fuera de pantalla, las captura y arma el PDF horizontal
  useEffect(() => {
    if (!generandoPDF || slidesPDF.length === 0) return;
    let cancelado = false;

    (async () => {
      try {
        const [html2canvas, jspdf] = await Promise.all([cargarHtml2Canvas(), cargarJsPDF()]);
        const JsPDF = jspdf.jsPDF || jspdf;
        // pequeña espera para asegurar que los logos/imágenes terminen de renderizar
        await new Promise(res => setTimeout(res, 450));

        const pdf = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        let agregadas = 0;
        for (let i = 0; i < slidesPDF.length; i++) {
          const el = slideRefs.current[slidesPDF[i].taller.nombre];
          if (!el) continue;
          const canvas = await html2canvas(el, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
          const img = canvas.toDataURL('image/jpeg', 0.95);
          if (agregadas > 0) pdf.addPage('a4', 'landscape');
          // Ajuste de aspecto: la imagen SIEMPRE cabe completa en la hoja horizontal (centrada),
          // aplicando además la escala elegida por el usuario antes de descargar.
          const fit = Math.min(pageW / canvas.width, pageH / canvas.height) * (escalaPDF / 100);
          const imgW = canvas.width * fit;
          const imgH = canvas.height * fit;
          pdf.addImage(img, 'JPEG', (pageW - imgW) / 2, (pageH - imgH) / 2, imgW, imgH);
          agregadas++;
        }

        if (!cancelado) {
          pdf.save(`Reporte_Ejecutivo_${filtroMes}_${filtroAno}.pdf`);
        }
      } catch (e) {
        alert('No se pudo generar el PDF. Verifique su conexión a internet e intente de nuevo.');
      } finally {
        if (!cancelado) {
          setGenerandoPDF(false);
          setSlidesPDF([]);
        }
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generandoPDF, slidesPDF]);

  // Genera y descarga el reporte como imagen PNG de alta resolución
  const generarImagen = async () => {
    if (!reporteImagenRef.current) return;
    setGenerandoImagen(true);
    try {
      const html2canvas = await cargarHtml2Canvas();
      const canvas = await html2canvas(reporteImagenRef.current, {
        scale: 3,                 // 3x = nitidez de alta resolución
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const link = document.createElement('a');
      const nombreTaller = tallerActivo ? tallerActivo.nombre.replace(/\s+/g, '_') : 'Reporte';
      link.download = `Reporte_${nombreTaller}_${filtroMes}_${filtroAno}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('No se pudo generar la imagen. Verifique su conexión a internet e intente de nuevo.');
    } finally {
      setGenerandoImagen(false);
    }
  };

  // Color tipo semáforo según el % de cumplimiento (Verde >=90, Amarillo 70-89, Rojo <70)
  const colorCumplimiento = (pct: number, fondoOscuro = false) =>
    pct >= 90 ? (fondoOscuro ? '#22c55e' : '#16a34a')
    : pct >= 70 ? (fondoOscuro ? '#fbbf24' : '#d97706')
    : (fondoOscuro ? '#f87171' : '#dc2626');

  return (
    <>
      {/* MAGIA CSS: ESTILOS QUE SEPARAN LA WEB DE LA IMPRESIÓN */}
      <style>{`
        @media screen {
          .print-only-report { display: none !important; }
        }
        
        @media print {
          /* PDF EN HORIZONTAL LANDSCAPE */
          @page { size: A4 landscape; margin: 0 8mm 8mm 8mm; }
          
          /* RESETEAR CONTENEDORES WEB PARA LA IMPRESIÓN */
          html, body, #root, .app-layout, .main-content {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .web-only-dashboard, .sidebar, .top-nav { display: none !important; }
          
          .print-only-report { 
            display: block !important; 
            width: 100% !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }

          /* CAMBIO 2: ENCABEZADO CENTRADO */
          .print-only-report .report-header {
            display: flex !important; flex-direction: column !important;
            justify-content: center !important; align-items: center !important; text-align: center !important;
            background-color: #1e293b !important; color: #ffffff !important;
            padding: 16px !important; margin: 0 0 16px 0 !important; border-radius: 0 0 10px 10px !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .print-only-report .report-header h1 { color: #ffffff !important; font-size: 20pt !important; margin: 0 !important; letter-spacing: 0.5px !important; }
          .print-only-report .report-header p { color: #cbd5e1 !important; margin: 4px 0 0 0 !important;}

          /* CAMBIO 2: TÍTULOS DE SECCIÓN CENTRADOS */
          .print-only-report .section-executive-title {
            display: block !important; font-size: 11pt !important; font-weight: 800 !important; color: #1e293b !important;
            text-transform: uppercase !important; margin: 0 0 12px 0 !important; letter-spacing: 0.5px !important;
            text-align: center !important;
            border-bottom: 2px solid #1d8cf8 !important; padding: 0 0 6px 0 !important;
            page-break-after: avoid !important;
          }
          .print-only-report .kpi-print-row {
            display: flex !important; gap: 15px !important; margin-bottom: 16px !important; page-break-inside: avoid !important;
          }
          .print-only-report .kpi-item {
            flex: 1 !important; border: 1px solid #e2e8f0 !important; padding: 16px 12px !important; text-align: center !important;
            background: #f8fafc !important; border-radius: 10px !important;
            box-shadow: 0 2px 5px rgba(15,23,42,0.10) !important;
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          .print-only-report .kpi-val { font-size: 18pt !important; font-weight: 900 !important; margin-top: 7px !important; }
          
          .print-only-report .card-print {
            border: 1px solid #e2e8f0 !important; border-radius: 10px !important; margin-bottom: 0 !important;
            padding: 12px 15px !important; page-break-inside: avoid !important; overflow: hidden !important;
          }
          
          .print-only-report table { width: 100% !important; border-collapse: collapse !important; }
          .print-only-report th { background: #f1f5f9 !important; padding: 6px !important; border-bottom: 2px solid #cbd5e1 !important; font-size: 8pt !important; text-align: left; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-only-report td { padding: 6px !important; border-bottom: 1px solid #f1f5f9 !important; font-size: 8pt !important; }
          .print-only-report tr:nth-child(even) { background: #fcfcfc !important; }

          /* CAMBIO 1: forzar impresión de colores en SVG y barras para que nada se vea vacío */
          .print-only-report svg circle, .print-only-report svg rect, .print-only-report svg path,
          .print-only-report .swatch, .print-only-report .bar-pdf {
            -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
          }
          
          .print-only-report .chart-print-box { position: relative !important; display: flex !important; justify-content: center !important; align-items: center !important; margin: 5px 0 !important; overflow: hidden !important; }
          
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* NUEVO: PDF EJECUTIVO — visible solo con Año + Mes seleccionados y SIN taller (Todos). Una hoja por taller. */}
            {filtroAno !== 'Todos' && filtroMes !== 'Todos' && filtroTaller === 'Todos' && (
              <button onClick={() => abrirAjustePDF('ejecutivo')} disabled={generandoPDF} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, color: '#fff', border: 'none', cursor: generandoPDF ? 'not-allowed' : 'pointer', opacity: generandoPDF ? 0.6 : 1, background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)' }} title="Generar PDF ejecutivo (una hoja por taller) del mes y año seleccionados">
                <FileText size={18} /> {generandoPDF ? 'Generando PDF...' : 'PDF Ejecutivo (Todos los Talleres)'}
              </button>
            )}
            <button onClick={generarImagen} disabled={!filtrosCompletos || generandoImagen} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, color: '#fff', border: 'none', cursor: (!filtrosCompletos || generandoImagen) ? 'not-allowed' : 'pointer', opacity: (!filtrosCompletos || generandoImagen) ? 0.55 : 1, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)' }} title={!filtrosCompletos ? 'Seleccione Año, Mes y Taller para habilitar' : 'Descargar reporte como imagen PNG'}>
              <Download size={18} /> {generandoImagen ? 'Generando...' : 'Generar Imagen'}
            </button>
            <button onClick={() => abrirAjustePDF('print')} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}>
              <Printer size={18} /> Exportar PDF
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-group"><label>Año</label><select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}><option value="Todos">Todos los años</option>{anosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="filter-group"><label>Mes</label><select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}><option value="Todos">Todos los meses</option>{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="filter-group"><label>Taller</label><select value={filtroTaller} onChange={(e) => setFiltroTaller(e.target.value)}><option value="Todos">Todos los talleres</option>{talleresDisponibles.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>


        {!filtrosCompletos ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '2rem' }}>
             <Filter size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
             <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Seleccione los filtros</h3>
             <p style={{ color: 'var(--text-muted)' }}>Debe seleccionar un Año, un Mes y un Taller específico para visualizar la información del dashboard.</p>
          </div>
        ) : (
          <>
            <h3 className="detail-section-title" style={{ marginTop: '0.5rem', marginBottom: '1rem', textAlign: 'center', width: '100%' }}><TextoEditable clave="dash.seccion.kpi" defecto="Key Performance Indicators (KPI) - Indicadores Clave de Desempeño" /></h3>
            <div className="kpi-grid">
              <div className="kpi-card meta">
                <div className="kpi-title"><TextoEditable clave="dash.kpi.metaTotal" defecto="Meta Total" /> <Target size={16} /></div>
                <div className="kpi-value" style={{ whiteSpace: 'nowrap' }}>{miFormatearMoneda(kpis.metaTotal)}</div>
              </div>
              <div className="kpi-card logrado">
                <div className="kpi-title"><TextoEditable clave="dash.kpi.logrado" defecto="Logrado" /> <TrendingUp size={16} color="var(--primary)" /></div>
                <div className="kpi-value" style={{ color: 'var(--primary)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(kpis.logradoTotal)}</div>
              </div>
              
              <div className="kpi-card faltante" style={{ position: 'relative', ...(kpis.isExcedente ? { borderLeftColor: 'var(--success)' } : {}) }}>
                {/* SOLO EL PORCENTAJE Y ALERTA, PARTE SUPERIOR DERECHA */}
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {kpis.isExcedente ? <TrendingUp size={16} color="var(--success)" /> : <AlertTriangle size={16} color="var(--danger)" />}
                  {kpis.porcentajeFaltanteExcedente}%
                </div>
                
                <div style={{ paddingRight: '5.5rem' }}>
                  <div className="kpi-title" style={{ color: kpis.isExcedente ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {kpis.isExcedente ? 'Excedente' : 'Faltante'}
                  </div>
                  <div className="kpi-value" style={{ color: kpis.isExcedente ? 'var(--success)' : 'var(--danger)', marginTop: '0.5rem', whiteSpace: 'nowrap' }}>
                    {miFormatearMoneda(kpis.faltanteTotal)}
                  </div>
                </div>
              </div>
              
              <div className="kpi-card" style={{ position: 'relative', borderBottom: '3px solid var(--primary)' }}>
                {/* SOLO EL PORCENTAJE E ICONO, PARTE SUPERIOR DERECHA */}
                <div style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  <Target size={16} color="var(--primary)" />
                  {kpis.porcentajeGlobal}%
                </div>
                
                <div style={{ paddingRight: '5.5rem' }}>
                  <div className="kpi-title" style={{ color: 'var(--text-main)' }}>
                    <TextoEditable clave="dash.kpi.cumplido" defecto="Cumplido" />
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--primary)', marginTop: '0.5rem', whiteSpace: 'nowrap' }}>
                    {miFormatearMoneda(kpis.logradoTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* GRILLA FLEXBOX EN LA WEB IGUAL QUE EN EL PDF */}
            <div className="dashboard-grid-custom" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <div className="card" style={{ flex: '1.2', minWidth: '300px', marginBottom: 0 }}>
                <h3 className="detail-section-title"><TextoEditable clave="dash.seccion.progreso" defecto="Progreso de la Meta (Operaciones #)" /></h3>
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
                              <tr key={op.id} onMouseEnter={() => setHoveredOp(op.id)} onMouseLeave={() => setHoveredOp(null)} style={{ backgroundColor: op.isFaltante ? 'rgba(239, 68, 68, 0.07)' : (isHovered ? 'var(--bg-highlight)' : 'transparent'), borderTop: op.isFaltante ? '2px solid rgba(239, 68, 68, 0.35)' : undefined, opacity: isDimmed ? 0.4 : 1, transition: 'all 0.2s', cursor: 'pointer' }}>
                                {op.isFaltante ? (
                                  <>
                                    <td style={{ textAlign: 'center', padding: '1.5rem 0.75rem' }}>
                                      <span className="op-badge" style={{ backgroundColor: op.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '46px', height: '46px', borderRadius: '12px', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)', boxShadow: `0 4px 14px ${op.color}55` }}>
                                        <AlertTriangle size={24} />
                                      </span>
                                    </td>
                                    <td style={{ padding: '1.5rem 0.75rem' }}>
                                      <div style={{ fontSize: '1.35rem', color: 'var(--danger)', fontWeight: 900, letterSpacing: '0.5px', lineHeight: 1.15 }}>Faltante por Cumplir</div>
                                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.35rem' }}>Meta no alcanzada</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--danger)', fontSize: '1.5rem', whiteSpace: 'nowrap', padding: '1.5rem 0.75rem' }}>{miFormatearMoneda(op.vendido)}</td>
                                    <td style={{ textAlign: 'center', padding: '1.5rem 0.75rem' }}><span style={{ color: 'var(--danger)', fontWeight: 900, fontSize: '1.5rem', whiteSpace: 'nowrap' }}>{op.porcentajeStr}%</span></td>
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

              <div className="card" style={{ flex: '1', minWidth: '300px', marginBottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
              </div>
            </div>


            {/* META ANUAL: dentro del apartado del Reporte Mensual Consolidado */}
            <div className="card" style={{ marginTop: '1.5rem', borderTop: '3px solid #ffbc11' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>
                  Meta Anual {resumenMetaAnual.ano} &nbsp;·&nbsp; {filtroTaller === 'Todos' ? 'Todos los talleres' : filtroTaller}
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
                      {resumenMetaAnual.metaAnual > 0 ? miFormatearMoneda(resumenMetaAnual.metaAnual) : '—'}
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
                      {resumenMetaAnual.tieneDatos ? miFormatearMoneda(resumenMetaAnual.logrado) : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.9rem 1.1rem', borderBottom: '3px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#ffffff', flexShrink: 0, boxShadow: '0 3px 10px #ef444455' }}>
                    <AlertCircle size={22} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.2rem' }}>Faltante por alcanzar</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: resumenMetaAnual.faltante === 0 && resumenMetaAnual.tieneDatos ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                      {!resumenMetaAnual.tieneDatos ? '—' : resumenMetaAnual.faltante === 0 ? 'Meta alcanzada ✓' : miFormatearMoneda(resumenMetaAnual.faltante)}
                    </div>
                  </div>
                </div>
              </div>

              {/* GRÁFICA DE RELOJ: alcanzado en verde, faltante en negro */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem' }}>
                {/* TÍTULO */}
                <div style={{ textAlign: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffbc11', letterSpacing: '2px' }}>
                    NIVEL ACTUAL DE ALCANCE
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', marginTop: '0.15rem' }}>
                    DESEMPEÑO VS META
                  </div>
                  <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, var(--border), transparent)', marginTop: '0.6rem' }} />
                </div>

                {renderGaugeMeta(resumenMetaAnual.pct)}

                {/* RESUMEN: ALCANZADO / FALTANTE en tonos sobrios */}
                <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', backgroundColor: 'var(--bg-body)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.4rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(21,128,61,0.18)', border: '2px solid #15803d', flexShrink: 0 }}>
                      <Target size={19} color="#15803d" />
                    </span>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px' }}>ALCANZADO</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>{resumenMetaAnual.pct.toFixed(2)}%</div>
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
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#991b1b', lineHeight: 1.1 }}>{Math.max(100 - resumenMetaAnual.pct, 0).toFixed(2)}%</div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>PARA LLEGAR AL 100%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* SEGUNDA GRILLA DE TABLA Y GRAFICA MENSUAL (FULL WIDTH EN WEB) */}
            <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Reporte Mensual Consolidado</h3>
                {filtroAno !== 'Todos' && <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>Año Fiscal: {filtroAno}</span>}
              </div>
              {/* CAMBIO 3: la columna "Semanas" va primero y es editable/guardable */}
              <table className="table" style={{ width: '100%' }}>
                <thead><tr><th style={{ textAlign: 'center' }}>Semanas</th><th>Mes</th><th style={{ textAlign: 'right' }}>Meta</th><th style={{ textAlign: 'right' }}>Ventas</th><th style={{ textAlign: 'center' }}>%</th><th style={{ textAlign: 'right' }}>Diferencia</th><th style={{ textAlign: 'center' }}>Estado</th></tr></thead>
                <tbody>
                  {reporteMensual.datosPorMes.map(fila => {
                    // Los meses de 5 semanas se resaltan en amarillo
                    const semanasFila = getSemanas(fila.mes, fila.numSemanas);
                    const esCinco = semanasFila >= 5;
                    return (
                    <tr key={fila.mes} style={esCinco ? { backgroundColor: 'rgba(247, 231, 51, 0.13)', borderLeft: '3px solid #F7E733' } : undefined}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          value={semanasFila}
                          onChange={(e) => {
                            const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                            guardarSemanas(fila.mes, isNaN(v) ? 0 : Math.max(0, v));
                          }}
                          title="Semanas del mes. Es igual para todos los talleres: se captura una sola vez y se comparte con todos los usuarios."
                          style={{ width: '56px', textAlign: 'center', backgroundColor: esCinco ? 'rgba(247, 231, 51, 0.22)' : 'var(--bg-body)', color: esCinco ? '#F7E733' : 'var(--text-main)', border: `1px solid ${esCinco ? '#F7E733' : 'var(--border)'}`, borderRadius: '6px', padding: '0.3rem', fontSize: '0.85rem', fontWeight: 800, outline: 'none' }}
                        />
                      </td>
                      <td><strong style={esCinco ? { color: '#F7E733' } : undefined}>{fila.mes}</strong>{esCinco && <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', fontWeight: 800, color: '#F7E733', border: '1px solid #F7E733', borderRadius: '10px', padding: '2px 6px', letterSpacing: '0.5px' }}>5 SEM</span>}</td>
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
                    );
                  })}
                </tbody>
                {/* LÓGICA DE EXCEDENTE EN EL FOOTER DE LA TABLA */}
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ textAlign: 'center', padding: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{totalSemanasMostrado}</td>
                    <td style={{ padding: '1rem' }}><strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Total</strong></td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{miFormatearMoneda(reporteMensual.totales.meta)}</td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>{miFormatearMoneda(reporteMensual.totales.ventas)}</td>
                    <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: 'var(--primary)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.ventas / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
                    <td style={{ textAlign: 'right', padding: '1rem', fontWeight: 700, color: reporteMensual.totales.isExcedente ? 'var(--success)' : 'var(--danger)' }}>
                       <div style={{fontSize: '0.7rem', textTransform: 'uppercase'}}>{reporteMensual.totales.isExcedente ? 'Excedente Total' : 'Faltante Total'}</div>
                       {miFormatearMoneda(reporteMensual.totales.porCumplir)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '1rem' }}><span style={{ color: reporteMensual.totales.isExcedente ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.porCumplir / reporteMensual.totales.meta) * 100).toFixed(2) : 0}%</span></td>
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
          </>
        )}
      </div>

      {/* =========================================================================
          2. VISTA PDF EXCLUSIVA (TOTALMENTE OCULTA EN LA WEB)
      ========================================================================= */}
      {filtrosCompletos && (
        <div className="print-only-report" style={{ zoom: escalaPDF / 100 } as React.CSSProperties}>
          
          {/* CAMBIO 2: encabezado centrado */}
          <div className="report-header">
            <h1 style={{ margin: 0 }}>Reporte de Gestión Ejecutiva</h1>
            <p style={{ fontSize: '11pt', marginTop: '5px' }}>
              {tallerActivo ? `Sucursal: ${tallerActivo.nombre}` : 'Consolidado Global de Operaciones'}
            </p>
            <p className="report-fecha" style={{ fontWeight: 600, fontSize: '11pt', marginTop: '4px' }}>{fechaReporte}</p>
          </div>

          <h3 className="section-executive-title">Key Performance Indicators (KPI) - Indicadores Clave de Desempeño</h3>
          <div className="kpi-print-row">
            <div className="kpi-item"><div style={{fontSize:'9.5pt', color:'#64748b', fontWeight: 700}}>🎯 META PROGRAMADA</div><div className="kpi-val">{miFormatearMoneda(kpis.metaTotal)}</div></div>
            <div className="kpi-item" style={{borderLeft:'4px solid #1d8cf8'}}><div style={{fontSize:'9.5pt', color:'#1d8cf8', fontWeight: 700}}>LOGRADO A LA FECHA</div><div className="kpi-val" style={{color:'#1d8cf8'}}>{miFormatearMoneda(kpis.logradoTotal)}</div></div>
            
            <div className="kpi-item" style={kpis.isExcedente ? {borderLeft:'4px solid #10b981'} : {}}>
              <div style={{fontSize:'9.5pt', color: kpis.isExcedente ? '#10b981' : '#f56036', fontWeight: 800}}>{kpis.isExcedente ? '📈 EXCEDENTE' : '📉 DÉFICIT / FALTANTE'}</div>
              <div className="kpi-val" style={{color: kpis.isExcedente ? '#10b981' : '#f56036'}}>{miFormatearMoneda(kpis.faltanteTotal)}</div>
              <div style={{fontSize:'9pt', fontWeight: 800, marginTop: '3px', color: kpis.isExcedente ? '#10b981' : '#f56036'}}>{signoTendencia}</div>
            </div>
            
            <div className="kpi-item"><div style={{fontSize:'9.5pt', color:'#64748b', fontWeight: 700}}>✅ % CUMPLIMIENTO</div><div className="kpi-val" style={{color: colorCumplimiento(kpis.porcentajeGlobal)}}>{kpis.porcentajeGlobal}%</div></div>
          </div>

          {/* TIRA DE INDICADORES PDF: 📅 DIARIO / 📊 SEMANAL (mismos valores guardados que la imagen) */}
          <div className="kpi-print-row">
            <div className="kpi-item" style={{borderLeft:'4px solid #475569'}}><div style={{fontSize:'9.5pt', color:'#475569', fontWeight: 700}}>📅 DIARIO</div><div className="kpi-val" style={{color:'#475569'}}>{miFormatearMoneda(diarioIndicador)}</div></div>
            <div className="kpi-item" style={{borderLeft:'4px solid #475569'}}><div style={{fontSize:'9.5pt', color:'#475569', fontWeight: 700}}>📊 SEMANAL</div><div className="kpi-val" style={{color:'#475569'}}>{miFormatearMoneda(semanalIndicador)}</div></div>
          </div>

          {/* GRILLA DE 2 COLUMNAS PARA CONDENSAR EL PDF (ambas columnas del MISMO tamaño) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px', alignItems: 'stretch' }}>
            <div className="card-print">
              <h3 className="section-executive-title">Detalle Operativo Semanal</h3>
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

            {/* CAMBIO 1: distribución de logros = anillo CONTENIDO + leyenda (sin habladores que se salgan) */}
            <div className="card-print">
              <h3 className="section-executive-title">Distribución de Logros</h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                {/* Donut con VIÑETAS (línea + punto + %) que apuntan a cada color. Todo contenido dentro del viewBox para no salirse del recuadro. */}
                <svg viewBox="0 0 260 200" style={{ width: '100%', maxWidth: '230px', height: 'auto', display: 'block' }}>
                  {(() => {
                    const cx = 130, cy = 100, R = 58, SW = 22;
                    const C = 2 * Math.PI * R;
                    const ops = segmentosMeta?.segs || [];
                    const arcos: any[] = [];
                    const vinetas: any[] = [];
                    let offset = 0;
                    let gradAcum = 0;
                    ops.forEach(op => {
                      const pct = op.pct;
                      const dash = (pct / 100) * C;
                      arcos.push(
                        <circle
                          key={`seg-${op.id}`}
                          cx={cx} cy={cy} r={R}
                          fill="none"
                          stroke={op.color}
                          strokeWidth={SW}
                          strokeDasharray={`${dash} ${C - dash}`}
                          strokeDashoffset={-offset}
                          transform={`rotate(-90 ${cx} ${cy})`}
                        />
                      );
                      offset += dash;

                      // Viñeta apuntando al sector: punto en el borde + línea corta + % del mismo color
                      const grados = pct * 3.6;
                      const midDeg = gradAcum + grados / 2;
                      gradAcum += grados;
                      if (pct >= 3) {
                        const rad = ((midDeg - 90) * Math.PI) / 180;
                        const rEdge = R + SW / 2;
                        const rLabel = R + SW / 2 + 13;
                        const x1 = cx + Math.cos(rad) * rEdge;
                        const y1 = cy + Math.sin(rad) * rEdge;
                        const x2 = cx + Math.cos(rad) * rLabel;
                        const y2 = cy + Math.sin(rad) * rLabel;
                        const derecha = Math.cos(rad) >= 0;
                        const tx = x2 + (derecha ? 3 : -3);
                        vinetas.push(
                          <g key={`vin-${op.id}`}>
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={op.color} strokeWidth={1.6} strokeDasharray="0.1,3" strokeLinecap="round" />
                            <circle cx={x1} cy={y1} r={2.4} fill={op.color} />
                            <text x={tx} y={y2 + 3} textAnchor={derecha ? 'start' : 'end'} fontSize="9" fontWeight="800" fill={op.color}>{op.porcentajeStr}%</text>
                          </g>
                        );
                      }
                    });
                    return [...arcos, ...vinetas];
                  })()}
                </svg>
                <div style={{ width: '100%' }}>
                  {(segmentosMeta?.leyenda || []).map(op => (
                    <div key={`leg-${op.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0', fontSize: '7.5pt', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <span className="swatch" style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: op.color, display: 'inline-block', flexShrink: 0 }}></span>
                        <span style={{ color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>{op.tipo === 'faltante' ? 'Faltante' : op.tipo === 'sobrante' ? 'Sobrante' : `Semana ${op.idx}`}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#1e293b', fontWeight: 700 }}>{miFormatearMoneda(op.valor)}</span>
                        <span style={{ color: op.color, fontWeight: 800, minWidth: '40px', textAlign: 'right' }}>{op.pct.toFixed(2)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>{/* cierre de la grilla de 2 columnas */}

          <div className="page-break"></div>

          {/* CAMBIO 3 (consistencia): en el PDF la columna SEM también va primero y usa el valor editado */}
          <div className="card-print" style={{ marginBottom: '15px' }}>
            <h3 className="section-executive-title">Estado de Resultados Mensual</h3>
            <table>
              <thead><tr><th style={{textAlign:'center'}}>SEM</th><th>MES</th><th style={{textAlign:'right'}}>META</th><th style={{textAlign:'right'}}>VENTAS</th><th style={{textAlign:'center'}}>%</th><th style={{textAlign:'right'}}>DIFERENCIA</th></tr></thead>
              <tbody>
                {reporteMensual.datosPorMes.map(f => (
                  <tr key={`print-mes-${f.mes}`}>
                    <td style={{textAlign:'center'}}>{getSemanas(f.mes, f.numSemanas)}</td>
                    <td><strong>{f.mes.substring(0,3)}</strong></td>
                    <td style={{textAlign:'right'}}>{f.meta > 0 ? miFormatearMoneda(f.meta) : '-'}</td>
                    <td style={{textAlign:'right', fontWeight:700}}>{f.ventas > 0 ? miFormatearMoneda(f.ventas) : '-'}</td>
                    <td style={{textAlign:'center'}}>{f.meta > 0 ? `${f.pctVentas.toFixed(2)}%` : '-'}</td>
                    <td style={{textAlign:'right', color: f.isExcedente ? '#10b981' : '#f56036'}}>{f.meta > 0 ? miFormatearMoneda(f.porCumplir) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{background:'#f8fafc'}}>
                <tr>
                  <td style={{textAlign:'center', fontWeight: 900}}>{totalSemanasMostrado}</td>
                  <td style={{fontWeight: 900}}>TOTAL</td>
                  <td style={{textAlign:'right', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.meta)}</td>
                  <td style={{textAlign:'right', color:'#1d8cf8', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.ventas)}</td>
                  <td style={{textAlign:'center', fontWeight: 900}}>{reporteMensual.totales.meta > 0 ? ((reporteMensual.totales.ventas/reporteMensual.totales.meta)*100).toFixed(2) : 0}%</td>
                  <td style={{textAlign:'right', color: reporteMensual.totales.isExcedente ? '#10b981' : '#f56036', fontWeight: 900}}>{miFormatearMoneda(reporteMensual.totales.porCumplir)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* CAMBIO 1: tendencia contenida, etiquetas dentro del recuadro */}
          <div className="card-print">
            <h3 className="section-executive-title">Tendencia de Desempeño</h3>
            <div className="chart-print-box" style={{ flexDirection: 'column' }}>
              <div style={{ width: '100%', position: 'relative' }}>
                <div style={{ height: '170px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '22px 12px 0 12px', borderBottom: '2px solid #cbd5e1' }}>
                  {tendenciaPDF.map(m => {
                    const h = (m.ventas / maxTendenciaPDF) * 100;
                    return (
                      <div key={`bar-${m.mes}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <span style={{ fontSize: '6.5pt', fontWeight: 800, color: '#1e293b', marginBottom: '3px', whiteSpace: 'nowrap' }}>{miFormatearMoneda(m.ventas)}</span>
                        <div className="bar-pdf" style={{ width: '100%', maxWidth: '44px', height: `${h}%`, backgroundColor: '#1d8cf8', borderRadius: '4px 4px 0 0' }}></div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '12px', padding: '5px 12px 0 12px' }}>
                  {tendenciaPDF.map(m => (
                    <div key={`lbl-${m.mes}`} style={{ flex: 1, textAlign: 'center', fontSize: '7pt', fontWeight: 700, color: '#64748b' }}>{m.mes.substring(0,3)}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          3. LIENZO OCULTO -> SE CAPTURA COMO IMAGEN PNG (REPORTE PROFESIONAL)
          Posicionado fuera de pantalla. Solo se renderiza con filtros completos.
      ========================================================================= */}
      {filtrosCompletos && datosReporteImagen && (
        <div
          ref={reporteImagenRef}
          style={{
            position: 'fixed', left: '-10000px', top: 0, zIndex: -50, pointerEvents: 'none',
            width: '1120px', backgroundColor: '#ffffff',
            fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a',
            borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
          }}
        >
          {/* ENCABEZADO */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #14532d 140%)', padding: '26px 32px', display: 'flex', alignItems: 'center', gap: '22px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }} />
            {tallerActivo && tallerActivo.logo ? (
              <div style={{ width: '120px', height: '64px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '6px', boxShadow: '0 4px 10px rgba(0,0,0,0.25)' }}>
                <img src={tallerActivo.logo} alt={tallerActivo.nombre} crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(34,197,94,0.4)' }}>
                <PieIcon size={34} color="#22c55e" />
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.15 }}>
                {tallerActivo ? tallerActivo.nombre : 'Consolidado'}
              </div>
              <div style={{ fontSize: '42px', fontWeight: 900, color: '#22c55e', letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 1.05, marginTop: '4px' }}>
                {filtroMes.toUpperCase()}
              </div>
              <div style={{ fontSize: '16px', color: '#e2e8f0', fontWeight: 600, marginTop: '8px', letterSpacing: '0.5px' }}>
                {datosReporteImagen.rangoDesde} &nbsp;AL&nbsp; {datosReporteImagen.rangoHasta} &nbsp;·&nbsp; AÑO FISCAL {filtroAno}
              </div>
            </div>

            <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '22px' }}>
              <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>✅ CUMPLIMIENTO</div>
              <div style={{ fontSize: '50px', color: colorCumplimiento(kpis.porcentajeGlobal, true), fontWeight: 900, whiteSpace: 'nowrap', marginTop: '2px', lineHeight: 1.05 }}>{kpis.porcentajeGlobal}%</div>
              <div style={{ fontSize: '19px', color: kpis.isExcedente ? '#22c55e' : '#f87171', fontWeight: 800, marginTop: '2px' }}>{kpis.isExcedente ? '📈' : '📉'} {kpis.isExcedente ? '+' : '-'}{kpis.porcentajeFaltanteExcedente}%</div>
            </div>
          </div>

          {/* TIRA DE INDICADORES: DIARIO / SEMANAL / CUMPLIMIENTO */}
          <div style={{ display: 'flex', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {[
              { label: '🎯 META', valor: miFormatearMoneda(kpis.metaTotal), color: '#0f172a' },
              { label: '📅 DIARIO', valor: miFormatearMoneda(datosReporteImagen.diario), color: '#475569' },
              { label: '📊 SEMANAL', valor: miFormatearMoneda(datosReporteImagen.semanal), color: '#475569' },
            ].map((chip, i) => (
              <div key={chip.label} style={{ flex: 1, padding: '18px 20px', textAlign: 'center', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                <div style={{ fontSize: '16px', color: '#475569', fontWeight: 800, letterSpacing: '1px' }}>{chip.label}</div>
                <div style={{ fontSize: '29px', color: chip.color, fontWeight: 900, marginTop: '6px', whiteSpace: 'nowrap' }}>{chip.valor}</div>
              </div>
            ))}
          </div>

          {/* CUERPO */}
          <div style={{ padding: '24px 32px 28px 32px' }}>

            {/* TABLA DE PERIODOS */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '13px 16px', fontSize: '15px', fontWeight: 800, color: '#cbd5e1', letterSpacing: '1px' }}>
                <div style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>REF</div>
                <div style={{ flex: 1 }}>PERIODO</div>
                <div style={{ width: '215px', textAlign: 'right' }}>MONTO</div>
                <div style={{ width: '110px', textAlign: 'right' }}>% META</div>
              </div>

              {datosReporteImagen.filas.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 16px', fontSize: '26px', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '8px', backgroundColor: f.color, color: '#fff', fontSize: '17px', fontWeight: 800 }}>{f.idx}</span>
                  </div>
                  <div style={{ flex: 1, color: '#334155', fontWeight: 600, fontSize: '21px' }}>{f.periodo}</div>
                  <div style={{ width: '215px', textAlign: 'right', color: '#0f172a', fontWeight: 800, whiteSpace: 'nowrap' }}>{miFormatearMoneda(f.vendido)}</div>
                  <div style={{ width: '110px', textAlign: 'right', color: f.color, fontWeight: 800 }}>{f.pctMeta.toFixed(0)}%</div>
                </div>
              ))}
            </div>

            {/* SECCIÓN FINAL: DONUT + TOTAL VENTAS (verde) Y FALTANTE POR CUMPLIR (rojo) */}
            <div style={{ marginTop: '24px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '34px', padding: '30px 34px' }}>
                {/* DONUT DE DISTRIBUCIÓN POR SEMANA */}
                <div style={{ flexShrink: 0, position: 'relative', width: '330px', height: '330px' }}>
                  <svg viewBox="0 0 220 220" width="330" height="330" style={{ display: 'block' }}>
                    {(segmentosMeta?.segs || []).length === 1 ? (
                      <circle cx="110" cy="110" r="95" fill={segmentosMeta!.segs[0].color} stroke="#ffffff" strokeWidth="2" />
                    ) : (
                      (segmentosMeta?.segs || []).map(seg => (
                        <path key={`pie-${seg.id}`} d={seg.path} fill={seg.color} stroke="#ffffff" strokeWidth="2" />
                      ))
                    )}
                    <circle cx="110" cy="110" r="52" fill="#ffffff" />
                    <text x="110" y="99" textAnchor="middle" fontSize="14" fontWeight="700" fill="#94a3b8">CUMPLIDO</text>
                    <text x="110" y="130" textAnchor="middle" fontSize="27" fontWeight="900" fill={colorCumplimiento(kpis.porcentajeGlobal)}>{kpis.porcentajeGlobal.toFixed(0)}%</text>
                  </svg>
                </div>

                {/* COLUMNA DERECHA: TOTAL VENTAS (verde) + FALTANTE POR CUMPLIR (rojo) */}
                {/* El porcentaje va como badge sólido en la esquina superior derecha de cada tarjeta */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* TOTAL VENTAS */}
                  <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '14px', padding: '26px 26px 24px 26px', textAlign: 'center' }}>
                    <div style={{ position: 'absolute', top: '14px', right: '16px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '25px', fontWeight: 900, padding: '5px 15px', borderRadius: '10px', letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(22,163,74,0.45)', whiteSpace: 'nowrap' }}>
                      {kpis.porcentajeGlobal.toFixed(0)}%
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '11px', paddingRight: '86px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#16a34a', color: '#fff', flexShrink: 0 }}><TrendingUp size={21} /></span>
                      <span style={{ fontSize: '21px', color: '#15803d', fontWeight: 900, letterSpacing: '1px' }}>TOTAL VENTAS</span>
                    </div>
                    <div style={{ fontSize: '50px', color: '#15803d', fontWeight: 900, marginTop: '14px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                      {miFormatearMoneda(kpis.logradoTotal)}
                    </div>
                  </div>

                  {/* FALTANTE POR CUMPLIR / EXCEDENTE / META ALCANZADA */}
                  {analisisOperaciones?.excedenteObj ? (
                    <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '14px', padding: '26px 26px 24px 26px', textAlign: 'center' }}>
                      <div style={{ position: 'absolute', top: '14px', right: '16px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '25px', fontWeight: 900, padding: '5px 15px', borderRadius: '10px', letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(22,163,74,0.45)', whiteSpace: 'nowrap' }}>
                        +{analisisOperaciones.excedenteObj.porcentaje.toFixed(0)}%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '11px', paddingRight: '86px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#16a34a', color: '#fff', flexShrink: 0 }}><TrendingUp size={21} /></span>
                        <span style={{ fontSize: '21px', color: '#15803d', fontWeight: 900, letterSpacing: '1px' }}>EXCEDENTE</span>
                      </div>
                      <div style={{ fontSize: '50px', color: '#15803d', fontWeight: 900, marginTop: '14px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                        {miFormatearMoneda(analisisOperaciones.excedenteObj.valor)}
                      </div>
                    </div>
                  ) : kpis.faltanteTotal > 0 ? (
                    <div style={{ position: 'relative', backgroundColor: 'rgba(239,68,68,0.08)', border: '2px solid #fca5a5', borderRadius: '14px', padding: '26px 26px 24px 26px', textAlign: 'center' }}>
                      <div style={{ position: 'absolute', top: '14px', right: '16px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '25px', fontWeight: 900, padding: '5px 15px', borderRadius: '10px', letterSpacing: '0.5px', boxShadow: '0 3px 10px rgba(239,68,68,0.45)', whiteSpace: 'nowrap' }}>
                        {kpis.porcentajeFaltanteExcedente}%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '11px', paddingRight: '86px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ef4444', color: '#fff', flexShrink: 0 }}><AlertTriangle size={21} /></span>
                        <span style={{ fontSize: '21px', color: '#dc2626', fontWeight: 900, letterSpacing: '1px' }}>FALTANTE POR CUMPLIR</span>
                      </div>
                      <div style={{ fontSize: '50px', color: '#dc2626', fontWeight: 900, marginTop: '14px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                        {miFormatearMoneda(kpis.faltanteTotal)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '14px', padding: '28px 26px', textAlign: 'center' }}>
                      <div style={{ position: 'absolute', top: '14px', right: '16px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '25px', fontWeight: 900, padding: '5px 15px', borderRadius: '10px', boxShadow: '0 3px 10px rgba(22,163,74,0.45)' }}>100%</div>
                      <div style={{ fontSize: '21px', color: '#15803d', fontWeight: 900, letterSpacing: '1px', paddingRight: '86px' }}>✓ META ALCANZADA</div>
                      <div style={{ fontSize: '50px', color: '#15803d', fontWeight: 900, marginTop: '14px' }}>Meta cumplida</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PIE DE PÁGINA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 32px', backgroundColor: '#0f172a', fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
            <span style={{ letterSpacing: '0.5px' }}>REPORTE DE GESTIÓN EJECUTIVA</span>
            <span>Generado el {fechaReporte}</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. DIAPOSITIVAS PDF EJECUTIVO (UNA HOJA HORIZONTAL POR TALLER)
          Se montan fuera de pantalla solo durante la generación, se capturan
          con html2canvas y se ensamblan en un PDF A4 horizontal con jsPDF.
      ========================================================================= */}
      {generandoPDF && slidesPDF.map((s: any) => {
        const d = s.datos;
        const t = s.taller;
        const signo = d.kpis.isExcedente
          ? `📈 +${d.kpis.porcentajeFaltanteExcedente}%`
          : `📉 -${d.kpis.porcentajeFaltanteExcedente}%`;
        return (
          <div
            key={`slide-${t.nombre}`}
            ref={el => { slideRefs.current[t.nombre] = el; }}
            style={{
              position: 'fixed', left: '-12000px', top: 0, zIndex: -50, pointerEvents: 'none',
              width: '1123px', minHeight: '794px', backgroundColor: '#ffffff',
              fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {/* ENCABEZADO */}
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #14532d 140%)', padding: '26px 40px', display: 'flex', alignItems: 'center', gap: '26px', position: 'relative', height: '150px', boxSizing: 'border-box' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '8px', background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)' }} />
              {t.logo ? (
                <div style={{ width: '150px', height: '84px', borderRadius: '12px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                  <img src={t.logo} alt={t.nombre} crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div style={{ width: '84px', height: '84px', borderRadius: '16px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(34,197,94,0.4)' }}>
                  <PieIcon size={42} color="#22c55e" />
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '30px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.1 }}>
                  {t.nombre}
                </div>
                <div style={{ fontSize: '38px', fontWeight: 900, color: '#22c55e', letterSpacing: '2px', textTransform: 'uppercase', lineHeight: 1.05, marginTop: '4px' }}>
                  {filtroMes.toUpperCase()}
                </div>
                <div style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 600, marginTop: '8px', letterSpacing: '0.5px' }}>
                  {d.rangoDesde} &nbsp;AL&nbsp; {d.rangoHasta} &nbsp;·&nbsp; AÑO FISCAL {filtroAno}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '26px' }}>
                <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>✅ CUMPLIMIENTO</div>
                <div style={{ fontSize: '46px', color: colorCumplimiento(d.kpis.porcentajeGlobal, true), fontWeight: 900, whiteSpace: 'nowrap', marginTop: '2px', lineHeight: 1.05 }}>{d.kpis.porcentajeGlobal}%</div>
                <div style={{ fontSize: '17px', color: d.kpis.isExcedente ? '#22c55e' : '#f87171', fontWeight: 800, marginTop: '2px' }}>{signo}</div>
              </div>
            </div>

            {/* TIRA META / DIARIO / SEMANAL */}
            <div style={{ display: 'flex', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', height: '92px' }}>
              {[
                { label: '🎯 META', valor: miFormatearMoneda(d.kpis.metaTotal), color: '#0f172a' },
                { label: '📅 DIARIO', valor: miFormatearMoneda(d.diario), color: '#475569' },
                { label: '📊 SEMANAL', valor: miFormatearMoneda(d.semanal), color: '#475569' },
              ].map((chip, i) => (
                <div key={chip.label} style={{ flex: 1, padding: '16px 24px', textAlign: 'center', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ fontSize: '13.5px', color: '#64748b', fontWeight: 800, letterSpacing: '1px' }}>{chip.label}</div>
                  <div style={{ fontSize: '30px', color: chip.color, fontWeight: 900, marginTop: '5px', whiteSpace: 'nowrap' }}>{chip.valor}</div>
                </div>
              ))}
            </div>

            {/* CUERPO: 2 COLUMNAS (tabla + anillo) */}
            <div style={{ flex: 1, display: 'flex', gap: '24px', padding: '22px 40px', minHeight: 0 }}>

              {/* IZQUIERDA: TABLA DE PERIODOS */}
              <div style={{ flex: 1.15, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '11px 18px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>
                    <div style={{ width: '48px', textAlign: 'center', flexShrink: 0 }}>REF</div>
                    <div style={{ flex: 1 }}>PERIODO</div>
                    <div style={{ width: '168px', textAlign: 'right' }}>MONTO</div>
                    <div style={{ width: '92px', textAlign: 'right' }}>% META</div>
                  </div>

                  {d.filas.map((f: any, i: number) => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', padding: '13px 18px', fontSize: '17px', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ width: '48px', textAlign: 'center', flexShrink: 0 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '7px', backgroundColor: f.color, color: '#fff', fontSize: '13px', fontWeight: 800 }}>{f.idx}</span>
                      </div>
                      <div style={{ flex: 1, color: '#334155', fontWeight: 600, fontSize: '14px' }}>{f.periodo}</div>
                      <div style={{ width: '168px', textAlign: 'right', color: '#0f172a', fontWeight: 800, whiteSpace: 'nowrap' }}>{miFormatearMoneda(f.vendido)}</div>
                      <div style={{ width: '92px', textAlign: 'right', color: f.color, fontWeight: 800 }}>{f.pctMeta.toFixed(0)}%</div>
                    </div>
                  ))}

                </div>
              </div>

              {/* DERECHA: DONA DE CUMPLIMIENTO + TOTAL VENTAS (verde) Y FALTANTE (rojo) */}
              <div style={{ flex: 0.92, border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#ffffff' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '20px 22px', minHeight: 0 }}>
                  {/* DONA */}
                  <div style={{ flexShrink: 0, width: '208px', height: '208px' }}>
                    <svg viewBox="0 0 220 220" width="208" height="208" style={{ display: 'block' }}>
                      {(d.segmentosMeta.segs || []).length === 1 ? (
                        <circle cx="110" cy="110" r="95" fill={d.segmentosMeta.segs[0].color} stroke="#ffffff" strokeWidth="2" />
                      ) : (
                        (d.segmentosMeta.segs || []).map((seg: any) => (
                          <path key={`pie-${t.nombre}-${seg.id}`} d={seg.path} fill={seg.color} stroke="#ffffff" strokeWidth="2" />
                        ))
                      )}
                      <circle cx="110" cy="110" r="52" fill="#ffffff" />
                      <text x="110" y="101" textAnchor="middle" fontSize="12" fontWeight="700" fill="#94a3b8">CUMPLIDO</text>
                      <text x="110" y="127" textAnchor="middle" fontSize="23" fontWeight="900" fill={colorCumplimiento(d.kpis.porcentajeGlobal)}>{d.kpis.porcentajeGlobal.toFixed(0)}%</text>
                    </svg>
                  </div>

                  {/* TARJETAS: TOTAL VENTAS Y FALTANTE / EXCEDENTE */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '11px' }}>

                    {/* TOTAL VENTAS */}
                    <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '11px', padding: '15px 16px 14px 16px', textAlign: 'center' }}>
                      <div style={{ position: 'absolute', top: '9px', right: '10px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '15px', fontWeight: 900, padding: '3px 10px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                        {d.kpis.porcentajeGlobal.toFixed(0)}%
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingRight: '54px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#16a34a', color: '#fff', flexShrink: 0 }}><TrendingUp size={14} /></span>
                        <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 900, letterSpacing: '0.8px' }}>TOTAL VENTAS</span>
                      </div>
                      <div style={{ fontSize: '29px', color: '#15803d', fontWeight: 900, marginTop: '8px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                        {miFormatearMoneda(d.kpis.logradoTotal)}
                      </div>
                    </div>

                    {/* FALTANTE / EXCEDENTE / META ALCANZADA */}
                    {d.excedenteObj ? (
                      <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '11px', padding: '15px 16px 14px 16px', textAlign: 'center' }}>
                        <div style={{ position: 'absolute', top: '9px', right: '10px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '15px', fontWeight: 900, padding: '3px 10px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                          +{d.excedenteObj.porcentaje.toFixed(0)}%
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingRight: '54px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#16a34a', color: '#fff', flexShrink: 0 }}><TrendingUp size={14} /></span>
                          <span style={{ fontSize: '13px', color: '#15803d', fontWeight: 900, letterSpacing: '0.8px' }}>EXCEDENTE</span>
                        </div>
                        <div style={{ fontSize: '29px', color: '#15803d', fontWeight: 900, marginTop: '8px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                          {miFormatearMoneda(d.excedenteObj.valor)}
                        </div>
                      </div>
                    ) : d.kpis.faltanteTotal > 0 ? (
                      <div style={{ position: 'relative', backgroundColor: 'rgba(239,68,68,0.08)', border: '2px solid #fca5a5', borderRadius: '11px', padding: '15px 16px 14px 16px', textAlign: 'center' }}>
                        <div style={{ position: 'absolute', top: '9px', right: '10px', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '15px', fontWeight: 900, padding: '3px 10px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                          {d.kpis.porcentajeFaltanteExcedente}%
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingRight: '54px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '7px', backgroundColor: '#ef4444', color: '#fff', flexShrink: 0 }}><AlertTriangle size={14} /></span>
                          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 900, letterSpacing: '0.8px' }}>FALTANTE POR CUMPLIR</span>
                        </div>
                        <div style={{ fontSize: '29px', color: '#dc2626', fontWeight: 900, marginTop: '8px', whiteSpace: 'nowrap', lineHeight: 1.05 }}>
                          {miFormatearMoneda(d.kpis.faltanteTotal)}
                        </div>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', backgroundColor: 'rgba(34,197,94,0.09)', border: '2px solid #86efac', borderRadius: '11px', padding: '17px 16px', textAlign: 'center' }}>
                        <div style={{ position: 'absolute', top: '9px', right: '10px', backgroundColor: '#16a34a', color: '#ffffff', fontSize: '15px', fontWeight: 900, padding: '3px 10px', borderRadius: '7px' }}>100%</div>
                        <div style={{ fontSize: '13px', color: '#15803d', fontWeight: 900, letterSpacing: '0.8px', paddingRight: '54px' }}>✓ META ALCANZADA</div>
                        <div style={{ fontSize: '26px', color: '#15803d', fontWeight: 900, marginTop: '8px' }}>Meta cumplida</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PIE DE PÁGINA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 40px', backgroundColor: '#0f172a', fontSize: '11px', color: '#64748b', fontWeight: 600, height: '42px', boxSizing: 'border-box' }}>
              <span style={{ letterSpacing: '0.5px' }}>REPORTE DE GESTIÓN EJECUTIVA &nbsp;·&nbsp; {filtroMes.toUpperCase()} {filtroAno}</span>
              <span>Generado el {fechaReporte}</span>
            </div>
          </div>
        );
      })}

      {/* =========================================================================
          MODAL: AJUSTAR PDF ANTES DE DESCARGAR (siempre horizontal)
      ========================================================================= */}
      {mostrarAjustePDF && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(8,12,22,0.72)', backdropFilter: 'blur(4px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card animate-in fade-in zoom-in" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>Ajustar PDF antes de descargar</h3>
            <p style={{ margin: '0.6rem 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              El PDF se genera <strong style={{ color: 'var(--text-main)' }}>siempre en horizontal (A4)</strong> y el contenido se ajusta automáticamente para no salirse de la hoja. Si lo deseas, reduce la escala para dejar más margen.
            </p>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Escala del contenido</span>
                <strong style={{ color: 'var(--primary)' }}>{escalaPDF}%</strong>
              </label>
              <input
                type="range"
                min={60}
                max={100}
                step={5}
                value={escalaPDF}
                onChange={(e) => setEscalaPDF(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' as any, cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                <span>60% (más margen)</span><span>100% (hoja completa)</span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => { setMostrarAjustePDF(false); setAccionPDF(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};