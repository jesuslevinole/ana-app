import { useState, useContext, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useInspecciones } from '../hooks/useInspecciones';
import { LineChart, TrendingUp, TrendingDown, Award, Filter, Download, Printer, FileText, ClipboardCheck, Target, GripVertical } from 'lucide-react';

type Modo = 'enteros' | 'porcentual';
type TipoGrafico = 'torta' | 'anillo' | 'barras' | 'lineas';

const COLORES = ['#1d8cf8', '#00d6b4', '#ff8d72', '#d048b6', '#ffbc11', '#51cbce', '#8965e0', '#2dce89', '#f56036', '#c72e6b', '#2a86ff', '#e2d849'];

// Formato de moneda en USD
const miFormatearMoneda = (valor: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number.isFinite(valor) ? valor : 0).replace('$', '$\u00A0');

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

  // --- Reordenamiento de tarjetas KPI (persistente y compartido vía Firestore) ---
  const ORDEN_DEFAULT = ['meta', 'mejor4', 'mejor5', 'variacion', 'cumplimiento'];
  const ordenGuardado = (contexto as any)?.inspeccionesOrden as string[] | undefined;
  const [ordenTarjetas, setOrdenTarjetas] = useState<string[]>(ORDEN_DEFAULT);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Sincroniza el orden con lo guardado en la nube (reconciliando ids nuevos/eliminados)
  useEffect(() => {
    if (Array.isArray(ordenGuardado) && ordenGuardado.length > 0) {
      const validos = ordenGuardado.filter(id => ORDEN_DEFAULT.includes(id));
      const faltantes = ORDEN_DEFAULT.filter(id => !validos.includes(id));
      setOrdenTarjetas([...validos, ...faltantes]);
    } else {
      setOrdenTarjetas(ORDEN_DEFAULT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ordenGuardado)]);

  const soltarTarjeta = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const nuevo = [...ordenTarjetas];
    const from = nuevo.indexOf(dragId);
    const to = nuevo.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    nuevo.splice(from, 1);
    nuevo.splice(to, 0, dragId);
    setOrdenTarjetas(nuevo);
    setDragId(null);
    setOverId(null);
    const guardar = (contexto as any)?.guardarInspeccionesOrden;
    if (typeof guardar === 'function') guardar(nuevo);
  };

  // --- Exportación: imagen PNG y PDF ejecutivo (una hoja por taller) ---
  const reporteImagenRef = useRef<HTMLDivElement>(null);
  const [generandoImagen, setGenerandoImagen] = useState<boolean>(false);
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
      setTimeout(() => window.print(), 180);
    }
    setAccionPDF(null);
  };

  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');
  const tallerObj = useMemo(() => talleres.find(t => t.nombre === tallerSeleccionado) || null, [talleres, tallerSeleccionado]);

  const fechaReporte = useMemo(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(inspecciones.filter(i => i.taller === tallerSeleccionado).map(i => String(i.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [inspecciones, tallerSeleccionado, anoActual]);

  // Datos del taller/año, en orden calendario, solo meses con registro (incluye costo/total)
  const datos = useMemo(() => {
    return MESES
      .map(mes => {
        const reg = inspecciones.find(i => i.taller === tallerSeleccionado && String(i.ano) === ano && i.mes === mes);
        if (!reg) return null;
        const costo = typeof (reg as any).costo === 'number' ? (reg as any).costo : 0;
        const total = typeof (reg as any).total === 'number' ? (reg as any).total : reg.cantidad * costo;
        const meta = typeof (reg as any).meta === 'number' ? (reg as any).meta : 0;
        const semanas = typeof (reg as any).semanas === 'number' && (reg as any).semanas > 0 ? (reg as any).semanas : 4;
        return { mes, cantidad: reg.cantidad, costo, total, meta, semanas };
      })
      .filter((d): d is { mes: string; cantidad: number; costo: number; total: number; meta: number; semanas: number } => d !== null);
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
      return { id: d.mes, label: d.mes, cantidad: d.cantidad, total: d.total, pct, porcentajeStr: pct.toFixed(1), midAngle, color, gradientPart: `${color} ${inicio}deg ${acumuladoGrados}deg` };
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
      const cumplimiento = d.meta > 0 ? (d.cantidad / d.meta) * 100 : null;
      return { ...d, deltaEntero, deltaPct, pctTotal, cumplimiento };
    });
  }, [datos]);

  const kpis = useMemo(() => {
    const total = datos.reduce((acc, d) => acc + d.cantidad, 0);
    const totalMonto = datos.reduce((acc, d) => acc + d.total, 0);
    const totalMeta = datos.reduce((acc, d) => acc + d.meta, 0);
    const cumplimientoGlobal = totalMeta > 0 ? (total / totalMeta) * 100 : null;
    const promedio = datos.length > 0 ? total / datos.length : 0;
    // Los meses de 5 semanas se agrupan aparte: no compiten como "mejor mes" normal
    const meses4 = datos.filter(d => d.semanas < 5);
    const meses5 = datos.filter(d => d.semanas >= 5);
    const mejor4 = meses4.reduce((best, d) => (d.cantidad > best.cantidad ? d : best), { mes: '-', cantidad: 0 });
    const mejor5 = meses5.reduce((best, d) => (d.cantidad > best.cantidad ? d : best), { mes: '-', cantidad: 0 });
    const hay5 = meses5.length > 0;
    let variacionUltimo: number | null = null;
    if (datos.length >= 2) {
      const a = datos[datos.length - 2].cantidad;
      const b = datos[datos.length - 1].cantidad;
      variacionUltimo = b - a; // diferencia en número de inspecciones (no porcentaje)
    }
    return { total, totalMonto, totalMeta, cumplimientoGlobal, promedio, mejor4, mejor5, hay5, variacionUltimo };
  }, [datos]);

  // =========================================================================
  // Construye TODO lo que necesita un reporte (imagen / diapositiva) por taller+año
  // =========================================================================
  const construirReporte = (tallerNombre: string, anoStr: string) => {
    const meses = MESES
      .map(mes => {
        const reg = inspecciones.find(i => i.taller === tallerNombre && String(i.ano) === anoStr && i.mes === mes);
        if (!reg) return null;
        const costo = typeof (reg as any).costo === 'number' ? (reg as any).costo : 0;
        const total = typeof (reg as any).total === 'number' ? (reg as any).total : reg.cantidad * costo;
        const meta = typeof (reg as any).meta === 'number' ? (reg as any).meta : 0;
        const semanas = typeof (reg as any).semanas === 'number' && (reg as any).semanas > 0 ? (reg as any).semanas : 4;
        return { mes, cantidad: reg.cantidad, costo, total, meta, semanas };
      })
      .filter((d): d is { mes: string; cantidad: number; costo: number; total: number; meta: number; semanas: number } => d !== null);

    const totalCantidad = meses.reduce((a, m) => a + m.cantidad, 0);
    const totalMonto = meses.reduce((a, m) => a + m.total, 0);
    const totalMeta = meses.reduce((a, m) => a + m.meta, 0);
    const cumplimiento = totalMeta > 0 ? (totalCantidad / totalMeta) * 100 : null;
    const promedio = meses.length > 0 ? totalCantidad / meses.length : 0;
    // Mejor mes: solo meses de 4 semanas (los de 5 semanas se agrupan aparte)
    const mejor = meses.filter(m => m.semanas < 5).reduce((b, m) => (m.cantidad > b.cantidad ? m : b), { mes: '-', cantidad: 0 });
    const mejor5 = meses.filter(m => m.semanas >= 5).reduce((b, m) => (m.cantidad > b.cantidad ? m : b), { mes: '-', cantidad: 0 });

    // Donut: distribución de inspecciones por mes
    const base = totalCantidad || 1;
    let acc = 0;
    const segs = meses.map((m, i) => {
      const frac = m.cantidad / base;
      const inicio = acc * 360;
      acc += frac;
      const fin = acc * 360;
      const color = COLORES[i % COLORES.length];
      return { id: m.mes, mes: m.mes, color, cantidad: m.cantidad, costo: m.costo, total: m.total, pct: frac * 100, path: arcoPie(110, 110, 95, inicio, fin) };
    });

    return { meses, totalCantidad, totalMonto, totalMeta, cumplimiento, promedio, mejor, mejor5, segs };
  };

  // Carga dinámica de html2canvas / jsPDF desde CDN
  const cargarHtml2Canvas = (): Promise<any> => new Promise((resolve, reject) => {
    const w = window as any;
    if (w.html2canvas) return resolve(w.html2canvas);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.async = true; s.onload = () => resolve((window as any).html2canvas); s.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
    document.body.appendChild(s);
  });
  const cargarJsPDF = (): Promise<any> => new Promise((resolve, reject) => {
    const w = window as any;
    if (w.jspdf) return resolve(w.jspdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.async = true; s.onload = () => resolve((window as any).jspdf); s.onerror = () => reject(new Error('No se pudo cargar jsPDF'));
    document.body.appendChild(s);
  });

  // Descarga el reporte del taller seleccionado como imagen PNG
  const generarImagen = async () => {
    if (!reporteImagenRef.current) return;
    setGenerandoImagen(true);
    try {
      const html2canvas = await cargarHtml2Canvas();
      const canvas = await html2canvas(reporteImagenRef.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const link = document.createElement('a');
      const nombre = tallerSeleccionado ? tallerSeleccionado.replace(/\s+/g, '_') : 'Inspecciones';
      link.download = `Inspecciones_${nombre}_${ano}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('No se pudo generar la imagen. Verifique su conexión a internet e intente de nuevo.');
    } finally {
      setGenerandoImagen(false);
    }
  };

  // Arma las diapositivas (una por taller) del año seleccionado
  const generarPDFEjecutivo = () => {
    const lista = talleresOrdenados
      .map(t => ({ taller: t, datos: construirReporte(t.nombre, ano) }))
      .filter(x => x.datos.meses.length > 0);
    if (lista.length === 0) {
      alert('No hay talleres con inspecciones registradas en el año seleccionado.');
      return;
    }
    setSlidesPDF(lista);
    setGenerandoPDF(true);
  };

  useEffect(() => {
    if (!generandoPDF || slidesPDF.length === 0) return;
    let cancelado = false;
    (async () => {
      try {
        const [html2canvas, jspdf] = await Promise.all([cargarHtml2Canvas(), cargarJsPDF()]);
        const JsPDF = jspdf.jsPDF || jspdf;
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
        if (!cancelado) pdf.save(`Inspecciones_Ejecutivo_${ano}.pdf`);
      } catch {
        alert('No se pudo generar el PDF. Verifique su conexión a internet e intente de nuevo.');
      } finally {
        if (!cancelado) { setGenerandoPDF(false); setSlidesPDF([]); }
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generandoPDF, slidesPDF]);

  // ---- GRÁFICA DE LÍNEAS (formato reporte: eje 1..12, círculo por mes con SU color y la cantidad dentro) ----
  const renderLinea = () => {
    const esPct = modo === 'porcentual';
    // Color de la gráfica según imagen de referencia (verde azulado oscuro / petróleo).
    // Si quieres otro tono, cambia este código hexadecimal:
    const tallerColor = '#16697A';
    const tallerLogo = tallerObj?.logo || '';

    // Cada punto se ubica en su mes real (0..11)
    const puntos = datos.map((d, i) => {
      const monthIdx = Math.max(0, MESES.indexOf(d.mes)); // 0..11
      let valor: number;
      if (!esPct) {
        valor = d.cantidad;
      } else {
        const prev = i > 0 ? datos[i - 1].cantidad : 0;
        valor = i > 0 && prev > 0 ? Number((((d.cantidad - prev) / prev) * 100).toFixed(1)) : 0;
      }
      return { monthIdx, valor, cantidad: d.cantidad, mes: d.mes };
    });

    // Gráfica un poco más pequeña
    const W = 960, H = 520, pl = 56, pr = 32, pt = 32, pb = 52;
    const iw = W - pl - pr, ih = H - pt - pb;
    const vals = puntos.map(p => p.valor);
    let min = Math.min(...vals, 0);
    let max = Math.max(...vals, 0);
    if (min === max) max = min + (esPct ? 10 : 5);
    max = max + (max - min) * 0.15; // aire arriba para que los círculos no toquen el borde
    const ticks = 5;
    const hayCero = min < 0 && max > 0;

    const colW = iw / 12;
    const X = (monthIdx: number) => pl + colW * monthIdx + colW / 2;
    const Y = (v: number) => pt + ih - ((v - min) / (max - min)) * ih;
    const poly = puntos.map(p => `${X(p.monthIdx).toFixed(1)},${Y(p.valor).toFixed(1)}`).join(' ');

    return (
      <div style={{ width: '100%' }}>
        {/* ENCABEZADO: logo a la izquierda + título grande con el color del taller */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '78px', marginBottom: '0.5rem' }}>
          {tallerLogo && (
            <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '72px', height: '72px', borderRadius: '14px', backgroundColor: '#ffffff', border: `2px solid ${tallerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '7px', boxShadow: '0 3px 10px rgba(0,0,0,0.3)', flexShrink: 0 }}>
              <img src={tallerLogo} alt={tallerSeleccionado} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
          )}
          <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: tallerColor, letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.1, padding: tallerLogo ? '0 88px' : '0' }}>
            {tallerSeleccionado} <span style={{ color: 'var(--text-muted)', fontWeight: 800 }}>· {ano}</span>
          </h3>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: '680px', display: 'block' }}>
            {/* Fondo gris claro de la gráfica (como la imagen de referencia) */}
            <rect x="0" y="0" width={W} height={H} rx="12" fill="#DDDFDA" />

            {/* Rejilla horizontal + escala Y */}
            {Array.from({ length: ticks + 1 }).map((_, k) => {
              const v = min + (max - min) * (k / ticks);
              const yy = Y(v);
              return (
                <g key={`grid-${k}`}>
                  <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="#b9bcb4" strokeWidth="1" opacity="0.7" />
                  <text x={pl - 10} y={yy + 4} textAnchor="end" fontSize="12" fontWeight="600" fill="#3f4a58">{esPct ? `${v.toFixed(0)}%` : Math.round(v)}</text>
                </g>
              );
            })}
            {hayCero && <line x1={pl} y1={Y(0)} x2={W - pr} y2={Y(0)} stroke="#3f4a58" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />}

            {/* Etiquetas del eje X: meses 1..12 */}
            {Array.from({ length: 12 }).map((_, m) => (
              <text key={`xl-${m}`} x={X(m)} y={H - pb + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="#3f4a58">{m + 1}</text>
            ))}

            {/* Línea que conecta los puntos con datos (color del taller) */}
            {puntos.length > 1 && (
              <polyline points={poly} fill="none" stroke={tallerColor} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Círculos: color del taller + cantidad de inspecciones dentro */}
            {puntos.map((p, i) => {
              const cx = X(p.monthIdx), cy = Y(p.valor);
              const texto = esPct ? `${p.valor}%` : String(p.cantidad);
              const r = texto.length >= 4 ? 20 : texto.length === 3 ? 18 : 16;
              const fs = texto.length >= 4 ? 10.5 : texto.length === 3 ? 11.5 : 13;
              return (
                <g key={`pt-${i}`}>
                  <circle cx={cx} cy={cy} r={r} fill={tallerColor} stroke="#ffffff" strokeWidth="3" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800" fill="#ffffff">{texto}</text>
                </g>
              );
            })}
          </svg>
        </div>
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
  const fmtNum = (n: any) => (typeof n === 'number' && n > 0 ? String(Math.round(n * 100) / 100) : '—');
  const colorCumpl = (v: number | null) => (v === null ? 'var(--text-muted)' : v >= 100 ? 'var(--success)' : v >= 70 ? 'var(--primary)' : 'var(--danger)');

  // Reporte del taller seleccionado (para la imagen PNG y el PDF de impresión)
  const reporteSel = useMemo(() => construirReporte(tallerSeleccionado, ano), [inspecciones, tallerSeleccionado, ano]);

  // Pequeño componente reutilizable: contenido del reporte (imagen / diapositiva)
  const ContenidoReporte = ({ rep, tNombre, tLogo, landscape }: { rep: any; tNombre: string; tLogo?: string; landscape?: boolean }) => (
    <>
      {/* ENCABEZADO */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #1e3a8a 140%)', padding: landscape ? '26px 40px' : '26px 32px', display: 'flex', alignItems: 'center', gap: '24px', position: 'relative', height: landscape ? '150px' : 'auto', boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: landscape ? '8px' : '6px', background: 'linear-gradient(180deg, #1d8cf8 0%, #2563eb 100%)' }} />
        {tLogo ? (
          <div style={{ width: landscape ? '150px' : '120px', height: landscape ? '84px' : '64px', borderRadius: '12px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <img src={tLogo} alt={tNombre} crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: landscape ? '84px' : '64px', height: landscape ? '84px' : '64px', borderRadius: '16px', background: 'rgba(29,140,248,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid rgba(29,140,248,0.4)' }}>
            <ClipboardCheck size={landscape ? 42 : 34} color="#1d8cf8" />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
          <div style={{ fontSize: landscape ? '30px' : '28px', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.1 }}>
            {tNombre}
          </div>
          <div style={{ fontSize: landscape ? '34px' : '36px', fontWeight: 900, color: '#38bdf8', letterSpacing: '2px', lineHeight: 1.05, marginTop: '4px' }}>
            {ano}
          </div>
          <div style={{ fontSize: landscape ? '14px' : '15px', color: '#e2e8f0', fontWeight: 600, marginTop: '8px', letterSpacing: '0.5px' }}>
            REPORTE DE INSPECCIONES &nbsp;·&nbsp; AÑO FISCAL {ano}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '24px' }}>
          <div style={{ fontSize: landscape ? '13px' : '14px', color: '#94a3b8', fontWeight: 700, letterSpacing: '1px' }}>🔍 INSPECCIONES</div>
          <div style={{ fontSize: landscape ? '46px' : '46px', color: '#38bdf8', fontWeight: 900, whiteSpace: 'nowrap', marginTop: '2px', lineHeight: 1.05 }}>{rep.totalCantidad}</div>
          <div style={{ fontSize: landscape ? '17px' : '18px', color: '#22c55e', fontWeight: 800, marginTop: '2px' }}>{miFormatearMoneda(rep.totalMonto)}</div>
        </div>
      </div>

      {/* TIRA DE INDICADORES */}
      <div style={{ display: 'flex', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', height: landscape ? '92px' : 'auto', flexWrap: 'wrap' }}>
        {[
          { label: '🔢 TOTAL INSPECCIONES', valor: String(rep.totalCantidad), color: '#0f172a' },
          { label: '🎯 META', valor: rep.totalMeta > 0 ? String(Math.round(rep.totalMeta * 100) / 100) : '—', color: '#1e3a8a' },
          { label: '✅ CUMPLIMIENTO', valor: rep.cumplimiento === null ? '—' : `${rep.cumplimiento.toFixed(0)}%`, color: '#15803d' },
          { label: '📊 PROMEDIO MENSUAL', valor: rep.promedio.toFixed(1), color: '#475569' },
          { label: '🏆 MEJOR MES', valor: `${rep.mejor.cantidad} (${rep.mejor.mes !== '-' ? rep.mejor.mes.substring(0, 3) : '-'})`, color: '#475569' },
          { label: '💲 TOTAL MONETARIO', valor: miFormatearMoneda(rep.totalMonto), color: '#15803d' },
        ].map((chip, i, arr) => (
          <div key={chip.label} style={{ flex: 1, minWidth: landscape ? undefined : '150px', padding: '14px 14px', textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: landscape ? '11px' : '13px', color: '#475569', fontWeight: 800, letterSpacing: '0.5px' }}>{chip.label}</div>
            <div style={{ fontSize: landscape ? '23px' : '25px', color: chip.color, fontWeight: 900, marginTop: '5px', whiteSpace: 'nowrap' }}>{chip.valor}</div>
          </div>
        ))}
      </div>

      {/* CUERPO: TABLA + ANILLO */}
      <div style={{ flex: landscape ? 1 : undefined, display: 'flex', gap: '24px', padding: landscape ? '22px 40px' : '24px 32px 28px 32px', minHeight: 0, flexDirection: landscape ? 'row' : 'column' }}>
        {/* TABLA MENSUAL */}
        <div style={{ flex: landscape ? 1.1 : undefined, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', flex: landscape ? 1 : undefined, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '11px 16px', fontSize: landscape ? '10px' : '15px', fontWeight: 800, color: '#cbd5e1', letterSpacing: '1px' }}>
              <div style={{ flex: 1 }}>MES</div>
              <div style={{ width: '95px', textAlign: 'center' }}>INSPECC.</div>
              <div style={{ width: '75px', textAlign: 'center' }}>META</div>
              <div style={{ width: '110px', textAlign: 'right' }}>COSTO</div>
              <div style={{ width: '130px', textAlign: 'right' }}>TOTAL</div>
            </div>
            {rep.meses.map((m: any, i: number) => (
              <div key={m.mes} style={{ display: 'flex', alignItems: 'center', padding: landscape ? '10px 16px' : '14px 16px', fontSize: landscape ? '13px' : '20px', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1, color: '#334155', fontWeight: 700 }}>
                  <span style={{ display: 'inline-block', width: landscape ? '10px' : '15px', height: landscape ? '10px' : '15px', borderRadius: '3px', backgroundColor: COLORES[i % COLORES.length], marginRight: '8px' }} />
                  {m.mes}
                </div>
                <div style={{ width: '95px', textAlign: 'center', color: '#0f172a', fontWeight: 800 }}>{m.cantidad}</div>
                <div style={{ width: '75px', textAlign: 'center', color: '#475569', fontWeight: 700 }}>{m.meta > 0 ? Math.round(m.meta * 100) / 100 : '—'}</div>
                <div style={{ width: '110px', textAlign: 'right', color: '#64748b' }}>{miFormatearMoneda(m.costo)}</div>
                <div style={{ width: '130px', textAlign: 'right', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>{miFormatearMoneda(m.total)}</div>
              </div>
            ))}
            {/* TOTAL */}
            <div style={{ display: 'flex', alignItems: 'center', padding: landscape ? '14px 16px' : '17px 16px', fontSize: landscape ? '14px' : '21px', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderTop: '2px solid #1d8cf8', marginTop: landscape ? 'auto' : undefined }}>
              <div style={{ flex: 1, color: '#ffffff', fontWeight: 900, letterSpacing: '0.5px' }}>TOTAL</div>
              <div style={{ width: '95px', textAlign: 'center', color: '#38bdf8', fontWeight: 900, fontSize: landscape ? '16px' : '25px' }}>{rep.totalCantidad}</div>
              <div style={{ width: '75px', textAlign: 'center', color: '#cbd5e1', fontWeight: 900 }}>{rep.totalMeta > 0 ? Math.round(rep.totalMeta * 100) / 100 : '—'}</div>
              <div style={{ width: '110px', textAlign: 'right', color: '#94a3b8' }}>—</div>
              <div style={{ width: '130px', textAlign: 'right', color: '#22c55e', fontWeight: 900, fontSize: landscape ? '15px' : '22px', whiteSpace: 'nowrap' }}>{miFormatearMoneda(rep.totalMonto)}</div>
            </div>
          </div>
        </div>

        {/* ANILLO DISTRIBUCIÓN POR MES */}
        <div style={{ flex: landscape ? 0.9 : undefined, marginTop: landscape ? 0 : '24px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ backgroundColor: '#f1f5f9', padding: landscape ? '10px 16px' : '13px 16px', fontSize: landscape ? '11px' : '16px', fontWeight: 800, color: '#334155', letterSpacing: '1px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
            DISTRIBUCIÓN DE INSPECCIONES POR MES
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: landscape ? 'column' : 'row', alignItems: 'center', gap: landscape ? '12px' : '20px', padding: '16px 20px', minHeight: 0 }}>
            <div style={{ flexShrink: 0, width: landscape ? '180px' : '230px', height: landscape ? '180px' : '230px' }}>
              <svg viewBox="0 0 220 220" width={landscape ? 180 : 230} height={landscape ? 180 : 230} style={{ display: 'block' }}>
                {(rep.segs || []).length === 1 ? (
                  <circle cx="110" cy="110" r="95" fill={rep.segs[0].color} stroke="#ffffff" strokeWidth="2" />
                ) : (
                  (rep.segs || []).map((seg: any) => (
                    <path key={`pie-${tNombre}-${seg.id}`} d={seg.path} fill={seg.color} stroke="#ffffff" strokeWidth="2" />
                  ))
                )}
                <circle cx="110" cy="110" r="46" fill="#ffffff" />
                <text x="110" y="101" textAnchor="middle" fontSize={landscape ? 11 : 13} fontWeight="700" fill="#94a3b8">TOTAL</text>
                <text x="110" y="126" textAnchor="middle" fontSize={landscape ? 14 : 20} fontWeight="900" fill="#1d8cf8">{rep.totalCantidad}</text>
              </svg>
            </div>
            <div style={{ flex: 1, width: landscape ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: landscape ? '6px' : '9px', minWidth: 0 }}>
              {(rep.segs || []).map((seg: any) => (
                <div key={`leg-${tNombre}-${seg.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: landscape ? '7px 12px' : '11px 14px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #eef2f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ width: landscape ? '13px' : '18px', height: landscape ? '13px' : '18px', borderRadius: '4px', backgroundColor: seg.color, flexShrink: 0 }} />
                    <span style={{ fontSize: landscape ? '12px' : '19px', color: '#475569', fontWeight: 700, whiteSpace: 'nowrap' }}>{seg.mes}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: landscape ? '12px' : '19px', color: '#0f172a', fontWeight: 800 }}>{seg.cantidad}</span>
                    <span style={{ fontSize: landscape ? '12px' : '19px', color: '#15803d', fontWeight: 700 }}>{miFormatearMoneda(seg.total)}</span>
                    <span style={{ fontSize: landscape ? '12px' : '19px', color: seg.color, fontWeight: 800, minWidth: landscape ? '44px' : '68px', textAlign: 'right' }}>{seg.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PIE DE PÁGINA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: landscape ? '11px 40px' : '13px 32px', backgroundColor: '#0f172a', fontSize: landscape ? '11px' : '13px', color: '#94a3b8', fontWeight: 600, height: landscape ? '42px' : 'auto', boxSizing: 'border-box' }}>
        <span style={{ letterSpacing: '0.5px' }}>REPORTE DE INSPECCIONES &nbsp;·&nbsp; {ano}</span>
        <span>Generado el {fechaReporte}</span>
      </div>
    </>
  );

  const hayDatos = datos.length > 0;

  // Mapa de tarjetas KPI (para renderizarlas en el orden guardado/arrastrado)
  const tarjetasMap: Record<string, React.ReactNode> = {
    meta: (
      <div className="kpi-card">
        <div className="kpi-title">Meta {ano} <Target size={16} color="var(--primary)" /></div>
        <div className="kpi-value" style={{ color: 'var(--primary)' }}>{kpis.totalMeta > 0 ? fmtNum(kpis.totalMeta) : '—'}</div>
      </div>
    ),
    mejor4: (
      <div className="kpi-card">
        <div className="kpi-title">Mejor mes (4 sem) <Award size={16} color="var(--success)" /></div>
        <div className="kpi-value" style={{ color: 'var(--success)' }}>{kpis.mejor4.cantidad || '—'}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.3rem' }}>{kpis.mejor4.mes !== '-' ? kpis.mejor4.mes : 'Sin datos'}</div>
      </div>
    ),
    mejor5: (
      <div className="kpi-card">
        <div className="kpi-title">Mejor mes (5 sem) <Award size={16} color="var(--primary)" /></div>
        <div className="kpi-value" style={{ color: kpis.hay5 ? 'var(--primary)' : 'var(--text-muted)' }}>{kpis.hay5 ? kpis.mejor5.cantidad : '—'}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: kpis.hay5 ? 'var(--text-main)' : 'var(--text-muted)', marginTop: '0.3rem' }}>{kpis.hay5 && kpis.mejor5.mes !== '-' ? kpis.mejor5.mes : 'Sin meses de 5 semanas'}</div>
      </div>
    ),
    variacion: (
      <div className="kpi-card" style={{ position: 'relative' }}>
        <div className="kpi-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Variación último mes
          {kpis.variacionUltimo !== null && (kpis.variacionUltimo >= 0
            ? <TrendingUp size={16} color="var(--success)" />
            : <TrendingDown size={16} color="var(--danger)" />)}
        </div>
        <div className="kpi-value" style={{ color: kpis.variacionUltimo === null ? 'var(--text-muted)' : (kpis.variacionUltimo >= 0 ? 'var(--success)' : 'var(--danger)') }}>
          {kpis.variacionUltimo === null ? '-' : `${kpis.variacionUltimo >= 0 ? '+' : ''}${kpis.variacionUltimo}`}
        </div>
      </div>
    ),
    cumplimiento: (
      <div className="kpi-card">
        <div className="kpi-title">% Cumplimiento <Target size={16} color="var(--success)" /></div>
        <div className="kpi-value" style={{ color: colorCumpl(kpis.cumplimientoGlobal) }}>
          {kpis.cumplimientoGlobal === null ? '—' : `${kpis.cumplimientoGlobal.toFixed(0)}%`}
        </div>
      </div>
    ),
  };

  return (
    <div className="animate-in fade-in">
      <style>{`
        .insp-kpis { gap: 0.85rem !important; }
        .insp-kpis.kpi-grid { display: flex; flex-wrap: wrap; justify-content: center; align-items: stretch; }
        .insp-kpis > div { display: flex; flex: 1 1 200px; min-width: 190px; max-width: 260px; }
        .insp-kpis .kpi-card { padding: 0.9rem 1rem !important; flex: 1; width: 100%; min-height: 120px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; text-align: center; }
        .insp-kpis .kpi-title { font-size: 0.72rem !important; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .insp-kpis .kpi-value { font-size: 1.5rem !important; }
        @media screen { .insp-print-only { display: none !important; } }
        @media print {
          @page { size: A4 landscape; margin: 0 8mm 8mm 8mm; }
          html, body, #root, .app-layout, .main-content { height: auto !important; min-height: auto !important; overflow: visible !important; position: static !important; background: #ffffff !important; color: #000 !important; }
          .web-only-insp, .sidebar, .top-nav { display: none !important; }
          .insp-print-only { display: block !important; width: 100% !important; }
          .insp-print-only * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { scrollbar-width: none !important; }
          ::-webkit-scrollbar { display: none !important; }
        }
      `}</style>

      <div className="web-only-insp">
        <div className="page-header">
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <LineChart size={32} color="var(--primary)" />
            <div>
              <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard de Inspecciones</h2>
              <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>Evolución, distribución y resumen monetario</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => abrirAjustePDF('ejecutivo')} disabled={generandoPDF} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, color: '#fff', border: 'none', cursor: generandoPDF ? 'not-allowed' : 'pointer', opacity: generandoPDF ? 0.6 : 1, background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)' }} title="PDF ejecutivo: una hoja por taller del año seleccionado">
              <FileText size={18} /> {generandoPDF ? 'Generando PDF...' : 'PDF Ejecutivo (Todos los Talleres)'}
            </button>
            <button onClick={generarImagen} disabled={!hayDatos || generandoImagen} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, color: '#fff', border: 'none', cursor: (!hayDatos || generandoImagen) ? 'not-allowed' : 'pointer', opacity: (!hayDatos || generandoImagen) ? 0.55 : 1, background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)' }} title={!hayDatos ? 'Sin datos para exportar' : 'Descargar reporte como imagen PNG'}>
              <Download size={18} /> {generandoImagen ? 'Generando...' : 'Generar Imagen'}
            </button>
            <button onClick={() => abrirAjustePDF('print')} disabled={!hayDatos} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, opacity: hayDatos ? 1 : 0.55, cursor: hayDatos ? 'pointer' : 'not-allowed' }}>
              <Printer size={18} /> Exportar PDF
            </button>
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
            {/* KPIs reordenables (arrastra para cambiar el orden; se guarda para todos) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0 0.6rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <GripVertical size={14} /> Arrastra las tarjetas para reordenarlas — el orden se guarda para todos los usuarios.
            </div>
            <div className="kpi-grid insp-kpis">
              {ordenTarjetas.map(id => {
                const card = tarjetasMap[id];
                if (!card) return null;
                const arrastrando = dragId === id;
                const esObjetivo = overId === id && dragId !== null && dragId !== id;
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setDragId(id)}
                    onDragEnter={() => setOverId(id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => soltarTarjeta(id)}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    style={{
                      cursor: 'grab',
                      opacity: arrastrando ? 0.45 : 1,
                      outline: esObjetivo ? '2px dashed var(--primary)' : 'none',
                      outlineOffset: '2px',
                      borderRadius: '12px',
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {card}
                  </div>
                );
              })}
            </div>

            {/* GRÁFICA CON CONTROLES */}
            <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Evolución de inspecciones</h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {tipoGrafico === 'lineas' && (
                    <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <button onClick={() => setModo('enteros')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'enteros' ? 'var(--primary)' : 'transparent', color: modo === 'enteros' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Enteros</button>
                      <button onClick={() => setModo('porcentual')} style={{ padding: '0.4rem 1rem', border: 'none', background: modo === 'porcentual' ? 'var(--primary)' : 'transparent', color: modo === 'porcentual' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>Variación %</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>TIPO:</label>
                    <select value={tipoGrafico} onChange={(e) => setTipoGrafico(e.target.value as TipoGrafico)} style={{ backgroundColor: 'var(--bg-body)', color: 'var(--text-main)', border: '1px solid var(--border)', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
                      <option value="lineas">Líneas (Line)</option>
                      <option value="barras">Barras (Bar)</option>
                      <option value="anillo">Anillo (Donut)</option>
                      <option value="torta">Torta (Pie)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', backgroundColor: 'var(--bg-body)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <button onClick={() => setIs3D(true)} style={{ padding: '0.4rem 1rem', border: 'none', background: is3D ? 'var(--primary)' : 'transparent', color: is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>3D</button>
                    <button onClick={() => setIs3D(false)} style={{ padding: '0.4rem 1rem', border: 'none', background: !is3D ? 'var(--primary)' : 'transparent', color: !is3D ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>2D</button>
                  </div>
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: '1120px', margin: '0 auto' }}>
                {renderGrafico()}
              </div>

              <ul className="legend-below-chart-list" style={{ listStyle: 'none', padding: 0, marginTop: '1rem', width: '100%', maxWidth: '1120px', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
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

            {/* TABLA DE EVOLUCIÓN (con apartado monetario) */}
            <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <h3 className="detail-section-title">Detalle de evolución</h3>
              <table className="table" style={{ width: '100%', marginTop: '1rem' }}>
                <thead>
                  {/* TOTALES: arriba del encabezado */}
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total</strong></td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{kpis.total}</td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>{kpis.totalMeta > 0 ? fmtNum(kpis.totalMeta) : '—'}</td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: colorCumpl(kpis.cumplimientoGlobal) }}>{kpis.cumplimientoGlobal === null ? '—' : `${kpis.cumplimientoGlobal.toFixed(0)}%`}</td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', color: 'var(--text-muted)' }}>—</td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: 'var(--success)' }}>{miFormatearMoneda(kpis.totalMonto)}</td>
                    <td colSpan={2}></td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>100%</td>
                  </tr>
                  <tr>
                    <th>Mes</th>
                    <th style={{ textAlign: 'center' }}>Inspecciones</th>
                    <th style={{ textAlign: 'right' }}>Meta</th>
                    <th style={{ textAlign: 'center' }}>% Cumpl.</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
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
                      <td style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: 600 }}>{fmtNum(f.meta)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: colorCumpl(f.cumplimiento) }}>{f.cumplimiento === null ? '—' : `${f.cumplimiento.toFixed(0)}%`}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{miFormatearMoneda(f.costo)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{miFormatearMoneda(f.total)}</td>
                      <td style={{ textAlign: 'center', color: f.deltaEntero === null ? 'var(--text-muted)' : (f.deltaEntero >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtDelta(f.deltaEntero)}</td>
                      <td style={{ textAlign: 'center', color: f.deltaPct === null ? 'var(--text-muted)' : (f.deltaPct >= 0 ? 'var(--success)' : 'var(--danger)'), fontWeight: 600 }}>{fmtPct(f.deltaPct)}</td>
                      <td style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>{f.pctTotal.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* =========================================================================
          PDF DE IMPRESIÓN (window.print) — solo visible al imprimir
      ========================================================================= */}
      {hayDatos && (
        <div className="insp-print-only" style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0', zoom: escalaPDF / 100 } as React.CSSProperties}>
          <ContenidoReporte rep={reporteSel} tNombre={tallerSeleccionado} tLogo={tallerObj?.logo} />
        </div>
      )}

      {/* =========================================================================
          LIENZO OCULTO -> IMAGEN PNG del taller seleccionado
      ========================================================================= */}
      {hayDatos && (
        <div
          ref={reporteImagenRef}
          style={{
            position: 'fixed', left: '-10000px', top: 0, zIndex: -50, pointerEvents: 'none',
            width: '880px', backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', color: '#0f172a',
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0',
          }}
        >
          <ContenidoReporte rep={reporteSel} tNombre={tallerSeleccionado} tLogo={tallerObj?.logo} />
        </div>
      )}

      {/* =========================================================================
          DIAPOSITIVAS PDF EJECUTIVO (UNA HOJA HORIZONTAL POR TALLER)
      ========================================================================= */}
      {generandoPDF && slidesPDF.map((s: any) => {
        const t = s.taller;
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
            <ContenidoReporte rep={s.datos} tNombre={t.nombre} tLogo={t.logo} landscape />
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
    </div>
  );
};