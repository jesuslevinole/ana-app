import { useState, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import {
  useMarketing, FUENTES_MARKETING, ETIQUETA_SIN_FORMULARIO, CORTA_SIN_FORMULARIO,
  COLOR_SIN_FORMULARIO, cantidadFuente
} from '../hooks/useMarketing';
import {
  useMarketingGastos, aporteMarketing, gastosMarketing, fondosMarketing
} from '../hooks/useMarketingGastos';
import { BarChart3, Download, Printer, Users, ClipboardX, Award, Megaphone, DollarSign } from 'lucide-react';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';

// =========================================================================
//  MARKETING · DASHBOARD
//  Reporte del origen de los clientes con la misma gráfica del formato de
//  Excel: BARRAS con la cantidad de clientes (eje izquierdo) y LÍNEA con el
//  porcentaje que representa cada procedencia (eje derecho).
// =========================================================================

// Color de texto (oscuro o blanco) que contrasta con un fondo hexadecimal
const colorTextoSobre = (hex: string): string => {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return '#111827';
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff';
};

// Máximo "redondo" para la escala de un eje (1, 2, 5 × 10ⁿ por división)
const escalaMaxima = (valor: number, divisiones: number): number => {
  if (!isFinite(valor) || valor <= 0) return divisiones;
  const bruto = valor / divisiones;
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / magnitud;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitud;
  return paso * divisiones;
};

// Paso "bonito" para el eje de dinero (más fino que 1-2-5 para que la
// gráfica no quede con la mitad del espacio vacío)
const pasoBonito = (bruto: number): number => {
  if (!isFinite(bruto) || bruto <= 0) return 1;
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / magnitud;
  const escalones = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const elegido = escalones.find(e => norm <= e) ?? 10;
  return elegido * magnitud;
};

const COLOR_BARRA = '#1d8cf8';
const COLOR_LINEA = '#f97316';

export const MarketingDashboard = () => {
  const contexto = useContext(AppContext);
  const { registros } = useMarketing();

  const talleres = contexto?.talleres ?? [];
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  // Filtro heredado de la presentación (taller, año, mes y semanas). Si no se
  // está presentando, cada control arranca con su valor de siempre.
  const filtroPres = useFiltroPresentacion();
  const [taller, setTaller] = useState<string>(oPorDefecto(filtroPres?.taller, ''));
  const [ano, setAno] = useState<string>(oPorDefecto(filtroPres?.ano, String(anoActual)));
  const [mes, setMes] = useState<string>(oPorDefecto(filtroPres?.mes, 'Todos'));

  const tallerSeleccionado = taller || (talleresOrdenados[0]?.nombre ?? '');
  const tallerObj = useMemo(
    () => talleres.find(t => t.nombre === tallerSeleccionado) || null,
    [talleres, tallerSeleccionado]
  );
  const tallerColor = (tallerObj && (tallerObj as unknown as { color?: string }).color) || COLOR_BARRA;
  const tallerLogo = tallerObj?.logo || '';

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.filter(r => r.taller === tallerSeleccionado).map(r => String(r.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [registros, tallerSeleccionado, anoActual]);

  // --- Datos del reporte: una fila por procedencia + los clientes sin formulario ---
  const reporte = useMemo(() => {
    const regs = registros.filter(r =>
      r.taller === tallerSeleccionado &&
      String(r.ano) === ano &&
      (mes === 'Todos' || r.mes === mes)
    );

    const deFuentes = FUENTES_MARKETING.map(f => ({
      clave: f.clave,
      etiqueta: f.etiqueta,
      corta: f.corta,
      color: f.color,
      cantidad: regs.reduce((acc, r) => acc + cantidadFuente(r, f.clave), 0),
    }));

    const sinFormulario = regs.reduce((acc, r) => acc + (r.sinFormulario || 0), 0);
    const conFormulario = deFuentes.reduce((acc, f) => acc + f.cantidad, 0);
    const total = conFormulario + sinFormulario;

    const filas = [
      ...deFuentes,
      {
        clave: 'sinFormulario',
        etiqueta: ETIQUETA_SIN_FORMULARIO,
        corta: CORTA_SIN_FORMULARIO,
        color: COLOR_SIN_FORMULARIO,
        cantidad: sinFormulario,
      },
    ].map(f => ({ ...f, pct: total > 0 ? (f.cantidad / total) * 100 : 0 }));

    // Procedencia con más clientes (sin contar a los que no llenaron formulario)
    const principal = filas
      .filter(f => f.clave !== 'sinFormulario')
      .sort((a, b) => b.cantidad - a.cantidad)[0] ?? null;

    return {
      filas,
      total,
      conFormulario,
      sinFormulario,
      principal: principal && principal.cantidad > 0 ? principal : null,
      periodos: regs.length,
    };
  }, [registros, tallerSeleccionado, ano, mes]);

  const hayDatos = reporte.total > 0;
  const pct = (n: number) => (reporte.total > 0 ? (n / reporte.total) * 100 : 0);

  const tituloPeriodo = mes === 'Todos' ? `AÑO ${ano}` : `${mes.toUpperCase()}  ·  AÑO ${ano}`;

  // --- Exportación a PNG (misma técnica que el resto de dashboards) ---
  const reporteRef = useRef<HTMLDivElement>(null);
  const [generandoImagen, setGenerandoImagen] = useState<boolean>(false);

  const cargarHtml2Canvas = (): Promise<(el: HTMLElement, op: object) => Promise<HTMLCanvasElement>> =>
    new Promise((resolve, reject) => {
      const w = window as unknown as { html2canvas?: (el: HTMLElement, op: object) => Promise<HTMLCanvasElement> };
      if (w.html2canvas) return resolve(w.html2canvas);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.async = true;
      s.onload = () => {
        const cargado = (window as unknown as { html2canvas?: (el: HTMLElement, op: object) => Promise<HTMLCanvasElement> }).html2canvas;
        if (cargado) resolve(cargado); else reject(new Error('html2canvas no disponible'));
      };
      s.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
      document.body.appendChild(s);
    });

  const generarImagen = async () => {
    if (!reporteRef.current) return;
    setGenerandoImagen(true);
    try {
      const html2canvas = await cargarHtml2Canvas();
      const canvas = await html2canvas(reporteRef.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const link = document.createElement('a');
      const nombre = tallerSeleccionado ? tallerSeleccionado.replace(/\s+/g, '_') : 'Marketing';
      link.download = `Marketing_${nombre}_${mes === 'Todos' ? ano : `${mes}_${ano}`}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      alert('No se pudo generar la imagen. Verifique su conexión a internet e intente de nuevo.');
    } finally {
      setGenerandoImagen(false);
    }
  };

  // =====================================================================
  //  GRÁFICA COMBINADA: barras (clientes) + línea (% del total)
  // =====================================================================
  const renderGrafica = () => {
    const filas = reporte.filas;
    const n = filas.length;

    const W = 1080, H = 560, pl = 74, pr = 84, pt = 54, pb = 168;
    const iw = W - pl - pr, ih = H - pt - pb;

    const divisiones = 6;
    const maxCantidad = Math.max(...filas.map(f => f.cantidad), 1);
    const maxPct = Math.max(...filas.map(f => f.pct), 1);
    const topCantidad = escalaMaxima(maxCantidad, divisiones);
    const topPct = Math.min(escalaMaxima(maxPct, divisiones), 100);

    const colW = iw / n;
    const X = (i: number) => pl + colW * i + colW / 2;
    const YCantidad = (v: number) => pt + ih - (v / topCantidad) * ih;
    const YPct = (v: number) => pt + ih - (v / topPct) * ih;

    const anchoBarra = Math.min(colW * 0.46, 56);
    const poly = filas.map((f, i) => `${X(i).toFixed(1)},${YPct(f.pct).toFixed(1)}`).join(' ');

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: '720px', display: 'block' }}>
          <rect x="0" y="0" width={W} height={H} rx="12" fill="#232b36" />

          {/* Leyenda */}
          <g>
            <rect x={pl} y={20} width="16" height="16" rx="3" fill={COLOR_BARRA} />
            <text x={pl + 24} y={33} fontSize="15" fontWeight="700" fill="#e2e8f0">Clientes</text>
            <line x1={pl + 116} y1={28} x2={pl + 156} y2={28} stroke={COLOR_LINEA} strokeWidth="4" strokeLinecap="round" />
            <circle cx={pl + 136} cy={28} r="6" fill={COLOR_LINEA} stroke="#ffffff" strokeWidth="2" />
            <text x={pl + 166} y={33} fontSize="15" fontWeight="700" fill="#e2e8f0">% del total</text>
          </g>

          {/* Rejilla y ejes */}
          {Array.from({ length: divisiones + 1 }).map((_, k) => {
            const vCant = (topCantidad / divisiones) * k;
            const vPct = (topPct / divisiones) * k;
            const yy = YCantidad(vCant);
            return (
              <g key={`grid-${k}`}>
                <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="#48515e" strokeWidth="1" opacity="0.65" />
                <text x={pl - 12} y={yy + 5} textAnchor="end" fontSize="15" fontWeight="700" fill="#9fb0c4">
                  {Math.round(vCant).toLocaleString('en-US')}
                </text>
                <text x={W - pr + 12} y={yy + 5} textAnchor="start" fontSize="15" fontWeight="700" fill={COLOR_LINEA}>
                  {vPct.toFixed(vPct >= 10 ? 0 : 1)}%
                </text>
              </g>
            );
          })}

          {/* Barras: cantidad de clientes por procedencia */}
          {filas.map((f, i) => {
            const alto = Math.max(pt + ih - YCantidad(f.cantidad), 0);
            const x = X(i) - anchoBarra / 2;
            const y = YCantidad(f.cantidad);
            return (
              <g key={`bar-${f.clave}`}>
                <title>{`${f.etiqueta}: ${f.cantidad} clientes (${f.pct.toFixed(2)}%)`}</title>
                <rect x={x} y={y} width={anchoBarra} height={alto} rx="4" fill={COLOR_BARRA} opacity="0.95" />
                {f.cantidad > 0 && (
                  <text x={X(i)} y={y - 9} textAnchor="middle" fontSize="16" fontWeight="800" fill="#ffffff">
                    {f.cantidad.toLocaleString('en-US')}
                  </text>
                )}
              </g>
            );
          })}

          {/* Línea: porcentaje que representa cada procedencia */}
          <polyline points={poly} fill="none" stroke={COLOR_LINEA} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {filas.map((f, i) => {
            const cy = YPct(f.pct);
            // El porcentaje exacto se lee en el eje derecho, en la tabla del
            // reporte y al pasar el puntero sobre el punto: no se rotula aquí
            // para no encimarse con las cifras de las barras.
            return (
              <g key={`pt-${f.clave}`}>
                <title>{`${f.etiqueta}: ${f.pct.toFixed(2)}% del total`}</title>
                <circle cx={X(i)} cy={cy} r="6" fill={COLOR_LINEA} stroke="#ffffff" strokeWidth="2" />
              </g>
            );
          })}

          {/* Eje X: nombre corto de cada procedencia (girado para que quepa) */}
          {filas.map((f, i) => (
            <text
              key={`xl-${f.clave}`}
              x={X(i)}
              y={pt + ih + 18}
              textAnchor="end"
              fontSize="15"
              fontWeight="700"
              fill="#e2e8f0"
              transform={`rotate(-38 ${X(i)} ${pt + ih + 18})`}
            >
              {f.corta}
            </text>
          ))}

          {/* Línea base del eje X */}
          <line x1={pl} y1={pt + ih} x2={W - pr} y2={pt + ih} stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />
        </svg>
      </div>
    );
  };

  // =====================================================================
  //  GASTOS DE MARKETING: aporte, gasto y fondos mes a mes
  // =====================================================================
  const { gastos } = useMarketingGastos();

  const serieGastos = useMemo(() => {
    const delTaller = gastos.filter(g => g.taller === tallerSeleccionado && String(g.ano) === ano);
    const meses = MESES
      .map(m => {
        const g = delTaller.find(x => x.mes === m);
        if (!g) return null;
        return {
          mes: m,
          aporte: aporteMarketing(g),
          gastado: gastosMarketing(g),
          fondos: fondosMarketing(g),
        };
      })
      .filter((x): x is { mes: string; aporte: number; gastado: number; fondos: number } => x !== null);

    const totales = meses.reduce((acc, m) => ({
      aporte: acc.aporte + m.aporte,
      gastado: acc.gastado + m.gastado,
      fondos: acc.fondos + m.fondos,
    }), { aporte: 0, gastado: 0, fondos: 0 });

    return { meses, totales };
  }, [gastos, tallerSeleccionado, ano]);

  const fmtDinero = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  // Barras de aporte y gasto + línea de fondos disponibles
  const renderGastos = () => {
    const filas = serieGastos.meses;

    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
          <h3 className="detail-section-title" style={{ margin: 0, border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={18} color="var(--primary)" /> Gastos de marketing
          </h3>
          <span style={{
            fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
            color: 'var(--text-muted)', backgroundColor: 'var(--bg-highlight)',
            border: '1px solid var(--border)', borderRadius: '999px', padding: '0.3rem 0.9rem'
          }}>
            {tallerSeleccionado} · {ano}
          </span>
        </div>

        {filas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            No hay gastos capturados para {tallerSeleccionado || 'este taller'} en {ano}.
            Regístralos en "Marketing → Gastos".
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: '3px solid #1d8cf8' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Aporte del año</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1d8cf8' }}>{fmtDinero(serieGastos.totales.aporte)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: '3px solid var(--danger)' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Gastado</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)' }}>{fmtDinero(serieGastos.totales.gastado)}</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', padding: '0.7rem 0.9rem', borderBottom: `3px solid ${serieGastos.totales.fondos >= 0 ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Fondos disponibles</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: serieGastos.totales.fondos >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtDinero(serieGastos.totales.fondos)}</div>
              </div>
            </div>

            {(() => {
              const W = 1080, H = 460, pl = 88, pr = 32, pt = 54, pb = 74;
              const iw = W - pl - pr, ih = H - pt - pb;
              const divisiones = 5;
              const maxValor = Math.max(...filas.map(f => Math.max(f.aporte, f.gastado, f.fondos)), 1);
              const minValor = Math.min(...filas.map(f => f.fondos), 0);
              const paso = pasoBonito((maxValor - Math.min(minValor, 0)) / divisiones);
              const top = Math.ceil(maxValor / paso) * paso;
              const piso = minValor < 0 ? -Math.ceil(Math.abs(minValor) / paso) * paso : 0;

              const colW = iw / filas.length;
              const X = (i: number) => pl + colW * i + colW / 2;
              const Y = (v: number) => pt + ih - ((v - piso) / (top - piso)) * ih;
              const anchoBarra = Math.min(colW * 0.3, 34);
              const poly = filas.map((f, i) => `${X(i).toFixed(1)},${Y(f.fondos).toFixed(1)}`).join(' ');

              return (
                <div style={{ width: '100%', maxWidth: '1120px', margin: '0 auto', overflowX: 'auto' }}>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: '720px', display: 'block' }}>
                    <rect x="0" y="0" width={W} height={H} rx="12" fill="#232b36" />

                    {/* Leyenda */}
                    <rect x={pl} y={22} width="16" height="16" rx="3" fill="#1d8cf8" />
                    <text x={pl + 24} y={35} fontSize="14" fontWeight="700" fill="#e2e8f0">Aporte</text>
                    <rect x={pl + 104} y={22} width="16" height="16" rx="3" fill="#ff4c4c" />
                    <text x={pl + 128} y={35} fontSize="14" fontWeight="700" fill="#e2e8f0">Gastado</text>
                    <line x1={pl + 216} y1={30} x2={pl + 256} y2={30} stroke="#2dce89" strokeWidth="4" strokeLinecap="round" />
                    <circle cx={pl + 236} cy={30} r="5" fill="#2dce89" stroke="#ffffff" strokeWidth="2" />
                    <text x={pl + 266} y={35} fontSize="14" fontWeight="700" fill="#e2e8f0">Fondos</text>

                    {/* Rejilla */}
                    {Array.from({ length: divisiones + 1 }).map((_, k) => {
                      const v = piso + ((top - piso) / divisiones) * k;
                      const yy = Y(v);
                      return (
                        <g key={`gg-${k}`}>
                          <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="#48515e" strokeWidth="1" opacity="0.6" />
                          <text x={pl - 10} y={yy + 5} textAnchor="end" fontSize="13" fontWeight="700" fill="#9fb0c4">{fmtDinero(v)}</text>
                        </g>
                      );
                    })}
                    {piso < 0 && <line x1={pl} y1={Y(0)} x2={W - pr} y2={Y(0)} stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />}

                    {/* Barras de aporte y gasto */}
                    {filas.map((f, i) => {
                      const yAporte = Y(f.aporte), yGasto = Y(f.gastado), base = Y(Math.max(piso, 0));
                      return (
                        <g key={`gb-${f.mes}`}>
                          <title>{`${f.mes}: aporte ${fmtDinero(f.aporte)} · gastado ${fmtDinero(f.gastado)} · fondos ${fmtDinero(f.fondos)}`}</title>
                          <rect x={X(i) - anchoBarra - 2} y={yAporte} width={anchoBarra} height={Math.max(base - yAporte, 0)} rx="3" fill="#1d8cf8" />
                          <rect x={X(i) + 2} y={yGasto} width={anchoBarra} height={Math.max(base - yGasto, 0)} rx="3" fill="#ff4c4c" opacity="0.9" />
                        </g>
                      );
                    })}

                    {/* Línea de fondos */}
                    {filas.length > 1 && (
                      <polyline points={poly} fill="none" stroke="#2dce89" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                    {filas.map((f, i) => (
                      <circle key={`gp-${f.mes}`} cx={X(i)} cy={Y(f.fondos)} r="6" fill="#2dce89" stroke="#ffffff" strokeWidth="2" />
                    ))}

                    {/* Eje X */}
                    {filas.map((f, i) => (
                      <text key={`gx-${f.mes}`} x={X(i)} y={pt + ih + 26} textAnchor="middle" fontSize="15" fontWeight="800" fill="#e2e8f0">
                        {f.mes.substring(0, 3)}
                      </text>
                    ))}
                    <line x1={pl} y1={pt + ih} x2={W - pr} y2={pt + ih} stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />
                  </svg>
                </div>
              );
            })()}

            {/* Detalle mes a mes */}
            <div style={{ overflowX: 'auto', marginTop: '1.5rem' }}>
              <table className="table" style={{ width: '100%', minWidth: '560px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total</strong></td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: '#1d8cf8' }}>{fmtDinero(serieGastos.totales.aporte)}</td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: 'var(--danger)' }}>{fmtDinero(serieGastos.totales.gastado)}</td>
                    <td style={{ textAlign: 'right', padding: '0.85rem', fontWeight: 800, color: serieGastos.totales.fondos >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtDinero(serieGastos.totales.fondos)}</td>
                  </tr>
                  <tr>
                    <th>Mes</th>
                    <th style={{ textAlign: 'right' }}>Aporte</th>
                    <th style={{ textAlign: 'right' }}>Gastado</th>
                    <th style={{ textAlign: 'right' }}>Fondos</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => (
                    <tr key={`tg-${f.mes}`}>
                      <td><strong>{f.mes}</strong></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#1d8cf8' }}>{fmtDinero(f.aporte)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-main)' }}>{fmtDinero(f.gastado)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: f.fondos >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtDinero(f.fondos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BarChart3 size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Dashboard de Marketing</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              De dónde vienen los clientes y cuánto aporta cada medio
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={generarImagen} className="btn btn-outline" disabled={!hayDatos || generandoImagen} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !hayDatos || generandoImagen ? 0.55 : 1 }}>
            <Download size={16} /> {generandoImagen ? 'Generando...' : 'Descargar PNG'}
          </button>
          <button onClick={() => window.print()} className="btn btn-outline" disabled={!hayDatos} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: hayDatos ? 1 : 0.55 }}>
            <Printer size={16} /> Imprimir
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
        <div className="filter-group">
          <label>Mes</label>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="Todos">Todo el año (acumulado)</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {!hayDatos ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Megaphone size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin datos para este periodo</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Captura la información en "Marketing → Registro" para ver el reporte de {tallerSeleccionado || 'este taller'}.
          </p>
        </div>
      ) : (
        <>
          {/* TARJETAS RESUMEN */}
          <div className="kpi-grid">
            <div className="kpi-card logrado">
              <div className="kpi-title">Total de clientes <Users size={16} /></div>
              <div className="kpi-value">{reporte.total.toLocaleString('en-US')}</div>
              <small style={{ color: 'var(--text-muted)' }}>{reporte.periodos} {reporte.periodos === 1 ? 'periodo' : 'periodos'} capturados</small>
            </div>
            <div className="kpi-card meta">
              <div className="kpi-title">Con formulario <Megaphone size={16} /></div>
              <div className="kpi-value">{reporte.conFormulario.toLocaleString('en-US')}</div>
              <small style={{ color: 'var(--text-muted)' }}>{pct(reporte.conFormulario).toFixed(2)} % del total</small>
            </div>
            <div className="kpi-card faltante">
              <div className="kpi-title">Sin formulario <ClipboardX size={16} /></div>
              <div className="kpi-value">{reporte.sinFormulario.toLocaleString('en-US')}</div>
              <small style={{ color: 'var(--text-muted)' }}>{pct(reporte.sinFormulario).toFixed(2)} % del total</small>
            </div>
            <div className="kpi-card logrado">
              <div className="kpi-title">Principal procedencia <Award size={16} /></div>
              <div className="kpi-value" style={{ fontSize: '1.35rem', lineHeight: 1.2 }}>
                {reporte.principal ? reporte.principal.corta : '—'}
              </div>
              <small style={{ color: 'var(--text-muted)' }}>
                {reporte.principal ? `${reporte.principal.cantidad} clientes · ${reporte.principal.pct.toFixed(2)} %` : 'Sin información'}
              </small>
            </div>
          </div>

          {/* ===================== REPORTE (lo que se exporta a PNG) ===================== */}
          <div ref={reporteRef}>

            {/* GRÁFICA DE PROCEDENCIAS */}
            <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                <h3 className="detail-section-title" style={{ margin: 0, border: 'none' }}>Origen de los clientes</h3>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
                  color: 'var(--text-muted)', backgroundColor: 'var(--bg-highlight)',
                  border: '1px solid var(--border)', borderRadius: '999px', padding: '0.3rem 0.9rem'
                }}>
                  {tituloPeriodo}
                </span>
              </div>

              {/* Encabezado del taller: logo a la izquierda y nombre en su color */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '1120px', minHeight: '104px', marginBottom: '0.5rem' }}>
                {tallerLogo && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '96px', height: '96px', borderRadius: '16px', backgroundColor: '#ffffff', border: `3px solid ${tallerColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '9px', boxShadow: '0 4px 12px rgba(0,0,0,0.35)' }}>
                    <img src={tallerLogo} alt={tallerSeleccionado} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <div style={{ padding: tallerLogo ? '0 112px' : 0, display: 'flex', justifyContent: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: colorTextoSobre(tallerColor), letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.15, backgroundColor: tallerColor, padding: '0.55rem 1.6rem', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.35)', border: '2px solid rgba(255,255,255,0.25)' }}>
                    {tallerSeleccionado} <span style={{ opacity: 0.85, fontWeight: 800 }}>· {mes === 'Todos' ? ano : `${mes} ${ano}`}</span>
                  </h3>
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: '1120px', margin: '0 auto' }}>
                {renderGrafica()}
              </div>
            </div>

            {/* DETALLE POR PROCEDENCIA */}
            <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
              <h3 className="detail-section-title">Detalle por procedencia</h3>
              <table className="table" style={{ width: '100%', marginTop: '1rem', minWidth: '640px' }}>
                <thead>
                  {/* TOTALES: arriba del encabezado, como en los demás dashboards */}
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderBottom: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.85rem' }}><strong style={{ color: 'var(--text-main)' }}>Total</strong></td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>{reporte.total.toLocaleString('en-US')}</td>
                    <td style={{ textAlign: 'center', padding: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>100.00%</td>
                    <td style={{ padding: '0.85rem' }}></td>
                  </tr>
                  <tr>
                    <th>Procedencia</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>Clientes</th>
                    <th style={{ textAlign: 'center', width: '130px' }}>% del total</th>
                    <th style={{ textAlign: 'center', minWidth: '180px' }}>Participación</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.filas.map(f => (
                    <tr key={f.clave}>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-main)', fontWeight: 600 }}>
                          <span style={{ width: '11px', height: '11px', borderRadius: '3px', backgroundColor: f.color, flexShrink: 0 }} />
                          {f.etiqueta}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: f.cantidad > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {f.cantidad.toLocaleString('en-US')}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: f.pct > 0 ? COLOR_LINEA : 'var(--text-muted)' }}>
                        {f.pct.toFixed(2)}%
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
                          <div style={{ flex: 1, maxWidth: '130px', height: '8px', backgroundColor: 'var(--bg-highlight)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(f.pct, 100)}%`, height: '100%', backgroundColor: f.color, borderRadius: '4px', transition: 'width 0.4s' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: 0, paddingTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                "Cliente sin formulario" son los clientes atendidos que no llenaron el formulario: suman al total pero no tienen procedencia conocida.
              </p>
            </div>
          </div>

          {/* GASTOS DE MARKETING (se ve al bajar) */}
          {renderGastos()}
        </>
      )}
    </div>
  );
};
