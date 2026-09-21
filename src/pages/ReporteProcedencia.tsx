import { useState, useContext, useMemo, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { MESES } from '../utils/formatters';
import { useFiltroPresentacion, oPorDefecto } from '../context/filtroPresentacion';
import { useMarketing } from '../hooks/useMarketing';
import { HojaProcedencia } from '../components/HojaProcedencia';
import { hayDatosProcedencia } from '../utils/procedencia';
import { exportarPNG, exportarPDF } from '../utils/exportar';
import { FileSpreadsheet, Printer, Download, FileDown } from 'lucide-react';

// =========================================================================
//  MARKETING · REPORTE DE PROCEDENCIA
//
//  Réplica del formato de Excel de la gerencia: una columna por procedencia,
//  y dos bloques separados por una línea gruesa —arriba los clientes de
//  MARKETING y abajo los de INSPECCIONES—, con subtotal de cada bloque y el
//  total general al pie.
//
//  Qué es cada renglón depende de los filtros:
//    · Un taller y todo el año  → un renglón por mes.
//    · Todos los talleres       → un renglón por taller.
//    · Un taller y un mes       → un único renglón con ese mes.
// =========================================================================

export const ReporteProcedencia = () => {
  const contexto = useContext(AppContext);
  const { registros } = useMarketing();
  const filtroPres = useFiltroPresentacion();

  const talleres = useMemo(() => contexto?.talleres ?? [], [contexto?.talleres]);
  const talleresOrdenados = useMemo(
    () => [...talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    [talleres]
  );

  const anoActual = new Date().getFullYear();
  const [taller, setTaller] = useState<string>(oPorDefecto(filtroPres?.taller, ''));
  const [ano, setAno] = useState<string>(oPorDefecto(filtroPres?.ano, String(anoActual)));
  const [mes, setMes] = useState<string>(oPorDefecto(filtroPres?.mes, 'Todos'));

  // Sin selección explícita se toma el primer taller, como en los dashboards
  const tallerSel = taller || (talleresOrdenados[0]?.nombre ?? '');
  const esTodos = tallerSel === 'Todos';

  const anosDisponibles = useMemo(() => {
    const set = new Set<string>(registros.map(r => String(r.ano)));
    set.add(String(anoActual));
    return Array.from(set).sort();
  }, [registros, anoActual]);

  // ¿Hay algo que mostrar con estos filtros? (para habilitar las descargas)
  const hayDatos = hayDatosProcedencia(registros, tallerSel, ano, mes);

  // --- Descarga del reporte (PNG / PDF) ---
  const hojaRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);

  const descargar = async (formato: 'png' | 'pdf') => {
    if (!hojaRef.current) return;
    const nombre = `Procedencia_${(esTodos ? 'Todos' : tallerSel).replace(/\s+/g, '_')}_${mes === 'Todos' ? ano : `${mes}_${ano}`}`;
    setDescargando(true);
    try {
      if (formato === 'png') await exportarPNG(hojaRef.current, nombre);
      else await exportarPDF(hojaRef.current, nombre);
    } catch {
      alert('No se pudo generar el archivo. Verifica tu conexión a internet e intenta de nuevo.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FileSpreadsheet size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Reporte de Procedencia</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Clientes por medio de llegada · marketing e inspecciones
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => descargar('png')} className="btn btn-outline" disabled={!hayDatos || descargando} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !hayDatos || descargando ? 0.55 : 1 }}>
            <Download size={16} /> {descargando ? 'Generando...' : 'Descargar PNG'}
          </button>
          <button onClick={() => descargar('pdf')} className="btn btn-outline" disabled={!hayDatos || descargando} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: !hayDatos || descargando ? 0.55 : 1 }}>
            <FileDown size={16} /> {descargando ? 'Generando...' : 'Descargar PDF'}
          </button>
          <button onClick={() => window.print()} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="filter-bar">
        <div className="filter-group">
          <label>Taller</label>
          <select value={tallerSel} onChange={(e) => setTaller(e.target.value)}>
            <option value="Todos">Todos los talleres</option>
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
            <option value="Todos">Todo el año</option>
            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* HOJA (es lo que se descarga) */}
      <div ref={hojaRef} className="zona-impresion zona-impresion--visible">
        <HojaProcedencia taller={tallerSel} ano={ano} mes={mes} />
      </div>
    </div>
  );
};
