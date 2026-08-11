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

  // Fecha en que se consulta el reporte (para el encabezado ejecutivo)
  const fechaReporte = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => r.ano.toString()));
    set.add(anoActual);
    return Array.from(set).sort();
  }, [registros, anoActual]);

  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  // =========================================================================
  //  DESEMPEÑO POR TALLER (ventas del año)
  //  Se evalúa el avance REAL contra el PLAN A LA FECHA: la meta a la fecha
  //  es la suma de las metas de los meses que ya tienen ventas registradas,
  //  de modo que los talleres con menos meses operando se comparan contra su
  //  propia meta proporcional y no contra el año completo.
  // =========================================================================
  const SEMANAS_ANO = 52;

  const porTaller = useMemo(() => {
    return talleresOrdenados
      .map(t => {
        const regs = registros.filter(r => r.ano.toString() === ano && r.taller === t.nombre);

        // Meta anual: suma de las metas mensuales registradas
        const meta = regs.reduce((acc, r) => acc + (r.meta || 0), 0);
        const logrado = regs.reduce((acc, r) => acc + (r.logrado || 0), 0);
        const faltante = Math.max(meta - logrado, 0);
        const pct = meta > 0 ? (logrado / meta) * 100 : 0;

        // Meses transcurridos = los que ya registraron ventas
        const mesesConVentas = regs.filter(r => (r.logrado || 0) > 0);
        const mesesOperando = regs.length;                 // meses con meta cargada
        const mesesTranscurridos = mesesConVentas.length;

        // Meta a la fecha (plan): metas de los meses ya transcurridos
        const metaALaFecha = mesesConVentas.reduce((acc, r) => acc + (r.meta || 0), 0);
        const difVsPlan = logrado - metaALaFecha;
        const pctALaFecha = metaALaFecha > 0 ? (logrado / metaALaFecha) * 100 : 0;

        // Semanas transcurridas: cada detalle de venta representa una semana
        const semanasTranscurridas = mesesConVentas.reduce((acc, r) => acc + ((r.detalles && r.detalles.length) || 0), 0);
        const semanasRestantes = Math.max(SEMANAS_ANO - semanasTranscurridas, 0);

        const promedioMensual = mesesTranscurridos > 0 ? logrado / mesesTranscurridos : 0;
        const promedioSemanal = semanasTranscurridas > 0 ? logrado / semanasTranscurridas : 0;
        // Lo que hace falta vender cada semana que queda para llegar a la meta
        const requeridoSemanal = semanasRestantes > 0 ? faltante / semanasRestantes : 0;

        // Proyección al cierre: si mantiene su promedio mensual actual
        const proyeccionCierre = promedioMensual * (mesesOperando > 0 ? mesesOperando : 12);
        const pctProyectado = meta > 0 ? (proyeccionCierre / meta) * 100 : 0;

        const metaEstablecida = obtenerMetaAnual('ventas', ano, t.nombre);

        return {
          nombre: t.nombre,
          color: (t as any).color || '#1d8cf8',
          meta, logrado, faltante, pct, metaEstablecida,
          mesesOperando, mesesTranscurridos,
          metaALaFecha, difVsPlan, pctALaFecha,
          semanasTranscurridas, semanasRestantes,
          promedioMensual, promedioSemanal, requeridoSemanal,
          proyeccionCierre, pctProyectado,
          parcial: mesesOperando > 0 && mesesOperando < 12,
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
    const metaALaFecha = porTaller.reduce((a, t) => a + t.metaALaFecha, 0);
    const difVsPlan = logrado - metaALaFecha;
    const pctALaFecha = metaALaFecha > 0 ? (logrado / metaALaFecha) * 100 : 0;
    const promedioMensual = porTaller.reduce((a, t) => a + t.promedioMensual, 0);
    const promedioSemanal = porTaller.reduce((a, t) => a + t.promedioSemanal, 0);
    const requeridoSemanal = porTaller.reduce((a, t) => a + t.requeridoSemanal, 0);
    const proyeccionCierre = porTaller.reduce((a, t) => a + t.proyeccionCierre, 0);
    const pctProyectado = meta > 0 ? (proyeccionCierre / meta) * 100 : 0;
    return {
      meta, logrado, faltante, pct, metaALaFecha, difVsPlan, pctALaFecha,
      promedioMensual, promedioSemanal, requeridoSemanal, proyeccionCierre, pctProyectado
    };
  }, [porTaller]);

  // --- RANKING DE DESEMPEÑO (por % de cumplimiento a la fecha) ---
  const ranking = useMemo(
    () => [...porTaller].sort((a, b) => b.pctALaFecha - a.pctALaFecha),
    [porTaller]
  );

  // --- RESUMEN EJECUTIVO ---
  const resumen = useMemo(() => {
    const cumpliendo = porTaller.filter(t => t.pctALaFecha >= 100).length;
    const debajo = porTaller.filter(t => t.pctALaFecha < 100).length;
    const parciales = porTaller.filter(t => t.parcial).length;
    return { cumpliendo, debajo, parciales, total: porTaller.length };
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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: '420px', height: 'auto' }}>
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
      {/* BANNER EJECUTIVO: título, fecha y filtro de año */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)',
        borderRadius: '14px 14px 0 0', padding: '1.1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
        borderBottom: '2px solid var(--primary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', borderRadius: '11px', backgroundColor: 'var(--primary)', color: '#fff', flexShrink: 0 }}>
            <FileBarChart size={24} />
          </span>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#ffffff', letterSpacing: '0.5px' }}>
            DASHBOARD EJECUTIVO DE VENTAS POR TALLER &nbsp;·&nbsp; AÑO {ano}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Fecha del reporte</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{fechaReporte}</div>
          </div>
          <select value={ano} onChange={(e) => setAno(e.target.value)}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px', padding: '0.45rem 0.75rem', fontWeight: 800, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}>
            {anosDisponibles.map(a => <option key={a} value={a} style={{ color: '#0f172a' }}>{a}</option>)}
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
          {/* BANDA DE KPIs: continúa el banner del encabezado */}
          <div style={{
            backgroundColor: 'var(--bg-panel)', borderRadius: '0 0 14px 14px', padding: '1.1rem 1.25rem',
            border: '1px solid var(--border)', borderTop: 'none', marginBottom: '1.5rem',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '0.9rem'
          }}>
            {[
              { titulo: 'Ventas YTD (real)',   sub: 'Total acumulado',           valor: miFormatearMoneda(totales.logrado),          color: '#22c55e', Icono: CheckCircle2 },
              { titulo: 'Meta anual',          sub: 'Total anual',               valor: miFormatearMoneda(totales.meta),             color: '#1d8cf8', Icono: Target },
              { titulo: 'Cumplimiento anual',  sub: 'Del total anual',           valor: `${totales.pct.toFixed(2)}%`,                color: colorPorAvance(totales.pct), Icono: TrendingUp },
              { titulo: 'Meta a la fecha',     sub: 'Plan acumulado a la fecha', valor: miFormatearMoneda(totales.metaALaFecha),     color: '#a855f7', Icono: Target },
              { titulo: 'Diferencia vs. plan', sub: totales.difVsPlan >= 0 ? 'Por encima del plan' : 'Debajo del plan', valor: `${totales.difVsPlan >= 0 ? '+' : '-'}${miFormatearMoneda(Math.abs(totales.difVsPlan))}`, color: totales.difVsPlan >= 0 ? '#22c55e' : '#ef4444', Icono: totales.difVsPlan >= 0 ? TrendingUp : TrendingDown },
              { titulo: 'Proyección cierre',   sub: 'Proyección anual actual',   valor: miFormatearMoneda(totales.proyeccionCierre), color: '#ffbc11', Icono: FileBarChart },
            ].map(k => (
              <div key={k.titulo} style={{ backgroundColor: 'var(--bg-body)', borderRadius: '10px', padding: '0.8rem 1rem', borderBottom: `3px solid ${k.color}`, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', backgroundColor: k.color, color: '#ffffff', flexShrink: 0, boxShadow: `0 3px 10px ${k.color}55` }}>
                  <k.Icono size={19} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.64rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{k.titulo}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color, whiteSpace: 'nowrap' }}>{k.valor}</div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>{k.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* DESEMPEÑO POR TALLER */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
            <div className="report-header" style={{ borderTop: '3px solid var(--primary)' }}>
              DESEMPEÑO POR TALLER &nbsp;·&nbsp; AÑO {ano}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: '1480px', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '190px' }}>Taller</th>
                    <th style={{ textAlign: 'center' }}>Meses<br />operando</th>
                    <th style={{ textAlign: 'right' }}>Meta anual<br />{ano}</th>
                    <th style={{ textAlign: 'right' }}>Meta a la fecha<br />(plan)</th>
                    <th style={{ textAlign: 'right' }}>Ventas YTD<br />(real)</th>
                    <th style={{ textAlign: 'right' }}>Diferencia<br />vs. plan</th>
                    <th style={{ textAlign: 'center' }}>% Cumplimiento<br />a la fecha</th>
                    <th style={{ textAlign: 'right' }}>Promedio<br />mensual</th>
                    <th style={{ textAlign: 'right' }}>Promedio<br />semanal</th>
                    <th style={{ textAlign: 'right' }}>Requerido por<br />semana restante</th>
                    <th style={{ textAlign: 'right' }}>Proyección<br />cierre {ano}</th>
                    <th style={{ textAlign: 'center' }}>% Cumplimiento<br />proyectado</th>
                    <th style={{ textAlign: 'center' }}>Semáforo</th>
                  </tr>
                </thead>
                <tbody>
                  {porTaller.map(t => (
                    <tr key={`dt-${t.nombre}`}>
                      <td>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: t.color, marginRight: '8px' }} />
                        <strong style={{ color: 'var(--text-main)' }}>{t.nombre}</strong>
                        {t.parcial && (
                          <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', marginLeft: '18px' }}>
                            Operación parcial ({t.mesesOperando} meses)
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{t.mesesOperando}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.meta)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#a855f7', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.metaALaFecha)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.logrado)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap', color: t.difVsPlan >= 0 ? '#22c55e' : '#ef4444' }}>
                        {t.difVsPlan >= 0 ? '+' : '-'}{miFormatearMoneda(Math.abs(t.difVsPlan))}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 900, color: colorPorAvance(t.pctALaFecha), whiteSpace: 'nowrap' }}>{t.pctALaFecha.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.promedioMensual)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.promedioSemanal)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#ffbc11', whiteSpace: 'nowrap' }}>
                        {t.semanasRestantes > 0 ? miFormatearMoneda(t.requeridoSemanal) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{miFormatearMoneda(t.proyeccionCierre)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 900, color: colorPorAvance(t.pctProyectado), whiteSpace: 'nowrap' }}>{t.pctProyectado.toFixed(2)}%</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', width: '17px', height: '17px', borderRadius: '50%', backgroundColor: colorPorAvance(t.pctALaFecha), boxShadow: `0 0 9px ${colorPorAvance(t.pctALaFecha)}` }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-highlight)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.9rem' }}><strong style={{ color: 'var(--text-main)' }}>Total todos los talleres</strong></td>
                    <td />
                    <td style={{ textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.meta)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#a855f7', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.metaALaFecha)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#22c55e', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.logrado)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap', color: totales.difVsPlan >= 0 ? '#22c55e' : '#ef4444' }}>
                      {totales.difVsPlan >= 0 ? '+' : '-'}{miFormatearMoneda(Math.abs(totales.difVsPlan))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: colorPorAvance(totales.pctALaFecha), whiteSpace: 'nowrap' }}>{totales.pctALaFecha.toFixed(2)}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.promedioMensual)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.promedioSemanal)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#ffbc11', whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.requeridoSemanal)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, whiteSpace: 'nowrap' }}>{miFormatearMoneda(totales.proyeccionCierre)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: colorPorAvance(totales.pctProyectado), whiteSpace: 'nowrap' }}>{totales.pctProyectado.toFixed(2)}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', width: '17px', height: '17px', borderRadius: '50%', backgroundColor: colorPorAvance(totales.pctALaFecha), boxShadow: `0 0 9px ${colorPorAvance(totales.pctALaFecha)}` }} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style={{ margin: 0, padding: '0.75rem 1.25rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              La <strong>meta a la fecha</strong> suma las metas de los meses que ya registraron ventas, por lo que los talleres con menos meses operando se evalúan contra su propia meta proporcional. La <strong>proyección de cierre</strong> asume que cada taller mantiene su promedio mensual actual.
            </p>
          </div>

          {/* RANKING DE DESEMPEÑO + RESUMEN EJECUTIVO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '1.5rem', marginTop: '1.5rem', alignItems: 'start' }}>
            {/* NIVEL ACTUAL DE ALCANCE (reloj) */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="report-header" style={{ borderTop: '3px solid #1d8cf8' }}>
                NIVEL ACTUAL DE ALCANCE
              </div>
              <div style={{ padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1.2px', marginBottom: '0.25rem' }}>
                  DESEMPEÑO VS META
                </div>
                {renderGauge(totales.pct)}
                <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-body)', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(21,128,61,0.18)', border: '2px solid #15803d', flexShrink: 0 }}>
                      <Target size={16} color="#15803d" />
                    </span>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px' }}>ALCANZADO</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803d', lineHeight: 1.1 }}>{totales.pct.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div style={{ width: '1px', backgroundColor: 'var(--border)' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(153,27,27,0.18)', border: '2px solid #991b1b', flexShrink: 0 }}>
                      <TrendingUp size={16} color="#991b1b" />
                    </span>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '1px' }}>FALTANTE</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#991b1b', lineHeight: 1.1 }}>{Math.max(100 - totales.pct, 0).toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* RANKING */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="report-header" style={{ borderTop: '3px solid #ffbc11' }}>
                RANKING DE DESEMPEÑO {ano}
              </div>
              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700, textAlign: 'center', letterSpacing: '0.5px', paddingBottom: '0.5rem' }}>
                  (% CUMPLIMIENTO A LA FECHA)
                </div>
                {ranking.map((t, i) => {
                  const medalla = ['#ffbc11', '#cbd5e1', '#c2703a'][i] || 'var(--bg-highlight)';
                  const textoMedalla = i < 3 ? '#111827' : 'var(--text-muted)';
                  return (
                    <div key={`rk-${t.nombre}`} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.7rem 1.25rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', backgroundColor: medalla, color: textoMedalla, fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem', minWidth: 0 }}>{t.nombre}</span>
                      <span style={{ fontWeight: 900, color: colorPorAvance(t.pctALaFecha), whiteSpace: 'nowrap' }}>{t.pctALaFecha.toFixed(2)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RESUMEN EJECUTIVO */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="report-header" style={{ borderTop: '3px solid #22c55e' }}>
                RESUMEN EJECUTIVO
              </div>
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  {
                    color: '#22c55e', Icono: CheckCircle2,
                    n: `${resumen.cumpliendo}`,
                    texto: resumen.cumpliendo === 1 ? 'taller está cumpliendo o superando el plan a la fecha.' : 'talleres están cumpliendo o superando el plan a la fecha.'
                  },
                  {
                    color: '#ef4444', Icono: AlertCircle,
                    n: `${resumen.debajo}`,
                    texto: resumen.debajo === 1 ? 'taller está por debajo del plan. Requiere acción inmediata.' : 'talleres están por debajo del plan. Requieren acción inmediata.'
                  },
                  {
                    color: '#a855f7', Icono: Target,
                    n: `${resumen.parciales}`,
                    texto: resumen.parciales === 1 ? 'taller en operación parcial. Enfocar en crecimiento acelerado.' : 'talleres en operación parcial. Enfocar en crecimiento acelerado.'
                  },
                  {
                    color: '#ffbc11', Icono: TrendingUp,
                    n: '',
                    texto: `La proyección total anual es de ${miFormatearMoneda(totales.proyeccionCierre)}, equivalente al ${totales.pctProyectado.toFixed(0)}% de la meta anual.`
                  },
                  {
                    color: '#1d8cf8', Icono: FileBarChart,
                    n: '',
                    texto: `Se requiere un promedio de ${miFormatearMoneda(totales.requeridoSemanal)} por semana en todos los talleres para alcanzar la meta.`
                  },
                ].map((r, i) => (
                  <div key={`re-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', backgroundColor: `${r.color}22`, border: `2px solid ${r.color}`, flexShrink: 0 }}>
                      <r.Icono size={17} color={r.color} />
                    </span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                      {r.n && <strong style={{ color: r.color, fontSize: '1rem' }}>{r.n} </strong>}
                      {r.texto}
                    </p>
                  </div>
                ))}
              </div>
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


          {/* NOTA AL PIE */}
          <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
            Nota: el cálculo de <strong>Meta a la fecha</strong> suma las metas de los meses que ya registraron ventas, por lo que los talleres con menos meses operando se evalúan contra su meta proporcional. La <strong>Proyección de cierre</strong> asume que cada taller mantiene su promedio mensual actual.
          </p>
        </>
      )}
    </div>
  );
};