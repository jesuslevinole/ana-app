import { useState, useMemo, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { CATALOGO_NAVEGACION, TODAS_LAS_VISTAS } from '../config/navegacion';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import {
  usePresentaciones, idDesdeNombre, normalizarTexto, DIAPOSITIVA_VACIA,
  SIN_ANO, SIN_TALLER, SIN_MES,
  type Presentacion as TipoPresentacion, type DiapositivaTexto
} from '../hooks/usePresentaciones';
import { ContextoFiltroPresentacion, type FiltroPresentacion } from '../context/filtroPresentacion';
import { MESES } from '../utils/formatters';

import { Dashboard } from './Dashboard';
import { Registros } from './Registros';
import { Comparacion } from './Comparacion';
import { ComparacionMeses } from './ComparacionMeses';
import { Talleres } from './Talleres';
import { InspeccionesRegistro } from './InspeccionesRegistro';
import { InspeccionesDashboard } from './InspeccionesDashboard';
import { InspeccionesComparacion } from './InspeccionesComparacion';
import { InspeccionesComparacionMeses } from './InspeccionesComparacionMeses';
import { ReporteAnualGeneral } from './ReporteAnualGeneral';
import { ReporteAnualInspecciones } from './ReporteAnualInspecciones';
import { MarketingRegistro } from './MarketingRegistro';
import { MarketingDashboard } from './MarketingDashboard';

import {
  MonitorPlay, Plus, Play, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, Check, GripVertical, Maximize2, Minimize2, Info, Presentation,
  Folder, Filter, CornerDownLeft, ListPlus
} from 'lucide-react';

// =========================================================================
//  PRESENTACIÓN
//
//  Permite armar una secuencia de módulos y recorrerlos a pantalla completa
//  como diapositivas, sin abrir pestañas ni navegar por el menú.
//
//  · ARMADO: se eligen los módulos y se ordenan (flechas o arrastrando).
//  · REPRODUCCIÓN: cada módulo se muestra completo, con botones de avanzar y
//    retroceder, flechas del teclado y pantalla completa del navegador.
// =========================================================================

// Qué componente se dibuja en cada diapositiva
const COMPONENTES: Record<string, () => ReactNode> = {
  dashboard: () => <Dashboard />,
  tabla: () => <Registros />,
  comparacion: () => <Comparacion />,
  comparacionMeses: () => <ComparacionMeses />,
  talleres: () => <Talleres />,
  inspeccionesRegistro: () => <InspeccionesRegistro />,
  inspeccionesDashboard: () => <InspeccionesDashboard />,
  inspeccionesComparacion: () => <InspeccionesComparacion />,
  inspeccionesComparacionMeses: () => <InspeccionesComparacionMeses />,
  reporteAnualGeneral: () => <ReporteAnualGeneral />,
  reporteAnualInspecciones: () => <ReporteAnualInspecciones />,
  marketing: () => <MarketingRegistro />,
  marketingDashboard: () => <MarketingDashboard />,
};

// Una diapositiva puede ser la portada, un módulo del sistema o el cierre
type Diapositiva =
  | { tipo: 'portada'; texto: DiapositivaTexto }
  | { tipo: 'cierre'; texto: DiapositivaTexto }
  | { tipo: 'vista'; vista: string };

// Color de texto (oscuro o blanco) que contrasta con un fondo hexadecimal
const colorTextoSobre = (hex: string): string => {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return '#ffffff';
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff';
};

const fechaDeHoy = () =>
  new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

export const Presentacion = () => {
  const contexto = useContext(AppContext);
  const talleres = contexto?.talleres ?? [];
  const { puedeVer, puedeEditar, puedeEliminar } = useAuth();
  const { t } = useEtiquetas();
  const { presentaciones, guardarPresentacion, eliminarPresentacion } = usePresentaciones();

  const puedoEditar = puedeEditar('presentacion');
  const puedoEliminar = puedeEliminar('presentacion');

  // --- Editor ---
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [vistas, setVistas] = useState<string[]>([]);
  // Filtro inicial: manda sobre todas las diapositivas y define la carpeta
  const [filtroAno, setFiltroAno] = useState('');
  const [filtroTaller, setFiltroTaller] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroSemanas, setFiltroSemanas] = useState('');
  const [portada, setPortada] = useState<DiapositivaTexto>({ ...DIAPOSITIVA_VACIA });
  const [cierre, setCierre] = useState<DiapositivaTexto>({ ...DIAPOSITIVA_VACIA });
  const [guardando, setGuardando] = useState(false);
  const [arrastrando, setArrastrando] = useState<number | null>(null);

  // --- Reproducción ---
  const [reproduciendo, setReproduciendo] = useState<TipoPresentacion | null>(null);
  const [indice, setIndice] = useState(0);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  const etiquetaVista = useCallback((vista: string) => {
    const item = TODAS_LAS_VISTAS.find(v => v.vista === vista);
    return item ? t(item.claveEtiqueta, item.etiqueta) : vista;
  }, [t]);

  // Nombre del grupo al que pertenece una vista (para ubicar al espectador)
  const grupoDeVista = useCallback((vista: string) => {
    const grupo = CATALOGO_NAVEGACION.find(g => g.items.some(i => i.vista === vista));
    return grupo ? t(grupo.claveEtiqueta, grupo.etiqueta) : '';
  }, [t]);

  // Solo se ofrecen los módulos que el usuario puede ver
  const disponiblesPorGrupo = useMemo(() => {
    return CATALOGO_NAVEGACION
      .map(g => ({
        ...g,
        items: g.items.filter(i => COMPONENTES[i.vista] && puedeVer(i.vista)),
      }))
      .filter(g => g.items.length > 0);
  }, [puedeVer]);

  const presentacionesOrdenadas = useMemo(
    () => [...presentaciones].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [presentaciones]
  );

  // =====================================================================
  //  CARPETAS: Año → Taller → Mes
  //  Los años y los meses se listan de mayor a menor (lo más reciente
  //  primero), que es como se revisa en las juntas.
  // =====================================================================
  const carpetaAno = (p: TipoPresentacion) => p.ano?.trim() || SIN_ANO;
  const carpetaTaller = (p: TipoPresentacion) => p.taller?.trim() || SIN_TALLER;
  const carpetaMes = (p: TipoPresentacion) => p.mes?.trim() || SIN_MES;

  // Año seleccionado / taller seleccionado (null = se está viendo ese nivel)
  const [anoAbierto, setAnoAbierto] = useState<string | null>(null);
  const [tallerAbierto, setTallerAbierto] = useState<string | null>(null);
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);

  // Ordena años de mayor a menor; "Sin año" siempre al final
  const ordenarAnos = (a: string, b: string) => {
    if (a === SIN_ANO) return 1;
    if (b === SIN_ANO) return -1;
    return (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0);
  };

  // Ordena meses de mayor a menor según el calendario; "Sin mes" al final
  const ordenarMeses = (a: string, b: string) => {
    if (a === SIN_MES) return 1;
    if (b === SIN_MES) return -1;
    return MESES.indexOf(b) - MESES.indexOf(a);
  };

  const ordenarTalleres = (a: string, b: string) => {
    if (a === SIN_TALLER) return 1;
    if (b === SIN_TALLER) return -1;
    return a.localeCompare(b);
  };

  // Cuenta cuántas presentaciones cuelgan de cada carpeta del nivel actual
  const agrupar = (lista: TipoPresentacion[], clave: (p: TipoPresentacion) => string) => {
    const mapa = new Map<string, TipoPresentacion[]>();
    lista.forEach(p => {
      const k = clave(p);
      mapa.set(k, [...(mapa.get(k) || []), p]);
    });
    return mapa;
  };

  const nivelAnos = useMemo(() => agrupar(presentacionesOrdenadas, carpetaAno), [presentacionesOrdenadas]);

  const enAno = useMemo(
    () => (anoAbierto ? (nivelAnos.get(anoAbierto) || []) : []),
    [nivelAnos, anoAbierto]
  );
  const nivelTalleres = useMemo(() => agrupar(enAno, carpetaTaller), [enAno]);

  const enTaller = useMemo(
    () => (tallerAbierto ? (nivelTalleres.get(tallerAbierto) || []) : []),
    [nivelTalleres, tallerAbierto]
  );
  const nivelMeses = useMemo(() => agrupar(enTaller, carpetaMes), [enTaller]);

  const enMes = useMemo(
    () => (mesAbierto ? (nivelMeses.get(mesAbierto) || []) : []),
    [nivelMeses, mesAbierto]
  );

  // Si se borra la última presentación de una carpeta, se vuelve al nivel útil
  const subirNivel = () => {
    if (mesAbierto) setMesAbierto(null);
    else if (tallerAbierto) setTallerAbierto(null);
    else setAnoAbierto(null);
  };

  // =====================================================================
  //  EDITOR
  // =====================================================================
  const abrirNueva = () => {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setVistas([]);
    setFiltroAno(String(new Date().getFullYear()));
    setFiltroTaller('');
    setFiltroMes('');
    setFiltroSemanas('');
    // Una presentación nueva llega con portada y cierre listos para usarse
    setPortada({ ...DIAPOSITIVA_VACIA, activa: true });
    setCierre({ ...DIAPOSITIVA_VACIA, activa: true, titulo: 'Gracias', subtitulo: '¿Preguntas?' });
    setModalAbierto(true);
  };

  const abrirEditar = (p: TipoPresentacion) => {
    setEditandoId(p.id);
    setNombre(p.nombre);
    setDescripcion(p.descripcion || '');
    setVistas([...p.vistas]);
    setFiltroAno(p.ano || '');
    setFiltroTaller(p.taller || '');
    setFiltroMes(p.mes || '');
    setFiltroSemanas(p.semanas || '');
    setPortada(normalizarTexto(p.portada));
    setCierre(normalizarTexto(p.cierre));
    setModalAbierto(true);
  };

  const alternarVista = (vista: string) => {
    setVistas(v => (v.includes(vista) ? v.filter(x => x !== vista) : [...v, vista]));
  };

  const mover = (desde: number, hacia: number) => {
    if (hacia < 0 || hacia >= vistas.length) return;
    setVistas(v => {
      const next = [...v];
      const [item] = next.splice(desde, 1);
      next.splice(hacia, 0, item);
      return next;
    });
  };

  const soltarEn = (destino: number) => {
    if (arrastrando === null || arrastrando === destino) { setArrastrando(null); return; }
    mover(arrastrando, destino);
    setArrastrando(null);
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert('Escribe un nombre para la presentación.'); return; }
    if (vistas.length === 0 && !portada.activa && !cierre.activa) {
      alert('Agrega al menos un módulo, una portada o un cierre a la presentación.');
      return;
    }
    const id = editandoId || idDesdeNombre(nombre);
    if (!editandoId && presentaciones.some(p => p.id === id)) {
      alert('Ya existe una presentación con ese nombre. Usa otro.');
      return;
    }
    setGuardando(true);
    try {
      const existente = presentaciones.find(p => p.id === id);
      await guardarPresentacion({
        id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        vistas,
        ano: filtroAno,
        taller: filtroTaller,
        mes: filtroMes,
        semanas: filtroSemanas,
        portada,
        cierre,
        creadoEn: existente?.creadoEn,
      });
      setModalAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (p: TipoPresentacion) => {
    if (!confirm(`¿Eliminar la presentación "${p.nombre}"?`)) return;
    await eliminarPresentacion(p.id);
  };

  // =====================================================================
  //  REPRODUCCIÓN
  // =====================================================================
  // Arma la secuencia completa: portada + módulos visibles + cierre
  const armarDiapositivas = useCallback((p: TipoPresentacion): Diapositiva[] => {
    const portadaP = normalizarTexto(p.portada);
    const cierreP = normalizarTexto(p.cierre);
    const lista: Diapositiva[] = [];
    if (portadaP.activa) lista.push({ tipo: 'portada', texto: portadaP });
    p.vistas.filter(v => COMPONENTES[v] && puedeVer(v)).forEach(v => lista.push({ tipo: 'vista', vista: v }));
    if (cierreP.activa) lista.push({ tipo: 'cierre', texto: cierreP });
    return lista;
  }, [puedeVer]);

  const diapositivas = useMemo(
    () => (reproduciendo ? armarDiapositivas(reproduciendo) : []),
    [reproduciendo, armarDiapositivas]
  );

  const presentar = (p: TipoPresentacion) => {
    if (armarDiapositivas(p).length === 0) {
      alert('Esta presentación no tiene diapositivas que puedas ver.');
      return;
    }
    setIndice(0);
    setReproduciendo(p);
  };

  const cerrarPresentacion = useCallback(() => {
    setReproduciendo(null);
    setIndice(0);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* el navegador no lo permitió */ });
    }
  }, []);

  const siguiente = useCallback(() => {
    setIndice(i => (i + 1 < diapositivas.length ? i + 1 : i));
  }, [diapositivas.length]);

  const anterior = useCallback(() => {
    setIndice(i => (i > 0 ? i - 1 : i));
  }, []);

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignorado */ });
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        alert('El navegador no permitió activar la pantalla completa.');
      });
    }
  };

  // Estado real de la pantalla completa (el usuario puede salir con F11 o Esc)
  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  // Teclado: flechas para navegar y Esc para salir
  useEffect(() => {
    if (!reproduciendo) return;
    const alPulsar = (e: KeyboardEvent) => {
      const destino = e.target as HTMLElement | null;
      const escribiendo = !!destino && ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
      if (escribiendo) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); siguiente(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); anterior(); }
      else if (e.key === 'Escape') { cerrarPresentacion(); }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [reproduciendo, siguiente, anterior, cerrarPresentacion]);

  // Cada diapositiva empieza arriba
  useEffect(() => {
    const cont = document.getElementById('lienzo-presentacion');
    if (cont) cont.scrollTop = 0;
  }, [indice]);

  // Blindaje: si dentro de una diapositiva se pulsa algo que navega a otra
  // vista (por ejemplo "Nuevo Registro"), la presentación se perdería. Aquí se
  // devuelve la navegación a su sitio para no cortar la exposición.
  const vistaApp = (contexto?.vista as string) ?? '';
  useEffect(() => {
    if (!reproduciendo) return;
    if (vistaApp && vistaApp !== 'presentacion' && contexto) {
      (contexto.setVista as (v: string) => void)('presentacion');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaApp, reproduciendo]);

  // Filtro que se inyecta a todas las diapositivas de la presentación activa
  const filtroActivo: FiltroPresentacion | null = reproduciendo
    ? {
        taller: reproduciendo.taller || '',
        ano: reproduciendo.ano || '',
        mes: reproduciendo.mes || '',
        semanas: reproduciendo.semanas || '',
      }
    : null;

  // Texto legible del periodo, para mostrarlo en portada y conclusión
  const textoPeriodo = (p?: TipoPresentacion | null): string => {
    if (!p) return '';
    const partes = [p.taller, p.mes, p.ano].filter(Boolean);
    return partes.join(' · ');
  };

  // Rótulo que se muestra en la barra superior y en los puntos de navegación
  const tituloDiapositiva = (d?: Diapositiva): string => {
    if (!d) return '';
    if (d.tipo === 'portada') return 'Portada';
    if (d.tipo === 'cierre') return 'Conclusión';
    return `${grupoDeVista(d.vista)} · ${etiquetaVista(d.vista)}`;
  };

  // PORTADA / CIERRE: pantalla completa con el color y el logo del taller
  const dibujarTexto = (texto: DiapositivaTexto, esPortada: boolean) => {
    const taller = talleres.find(t => t.nombre === texto.taller) || null;
    const color = (taller && (taller as unknown as { color?: string }).color) || '#1d8cf8';
    const textoSobre = colorTextoSobre(color);
    const titulo = texto.titulo.trim() || (esPortada ? (reproduciendo?.nombre ?? '') : 'Gracias');

    return (
      <div style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        gap: '1.5rem', padding: '3rem 2rem 7rem 2rem',
        background: `linear-gradient(135deg, ${color} 0%, rgba(0,0,0,0.55) 140%)`,
        color: textoSobre
      }}>
        {taller?.logo && (
          <div style={{
            width: '170px', height: '170px', borderRadius: '24px', backgroundColor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            boxShadow: '0 12px 34px rgba(0,0,0,0.4)'
          }}>
            <img src={taller.logo} alt={taller.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}

        <h1 style={{
          margin: 0, fontSize: 'clamp(2rem, 5.5vw, 3.6rem)', fontWeight: 900,
          letterSpacing: '0.5px', lineHeight: 1.1, textShadow: '0 3px 12px rgba(0,0,0,0.35)'
        }}>
          {titulo}
        </h1>

        {texto.subtitulo && (
          <h2 style={{ margin: 0, fontSize: 'clamp(1rem, 2.4vw, 1.6rem)', fontWeight: 600, opacity: 0.92, maxWidth: '900px' }}>
            {texto.subtitulo}
          </h2>
        )}

        {(texto.puntos || []).filter(x => x.trim()).length > 0 && (
          <ul style={{
            listStyle: 'none', margin: '0.5rem 0 0 0', padding: 0, textAlign: 'left',
            maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '0.85rem'
          }}>
            {(texto.puntos || []).filter(x => x.trim()).map((punto, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: 'clamp(0.95rem, 2vw, 1.35rem)', fontWeight: 500, lineHeight: 1.4 }}>
                <span style={{
                  flexShrink: 0, marginTop: '0.45em', width: '10px', height: '10px',
                  borderRadius: '50%', backgroundColor: textoSobre, opacity: 0.8
                }} />
                {punto}
              </li>
            ))}
          </ul>
        )}

        {(texto.pie || texto.mostrarFecha || (texto.mostrarPeriodo && textoPeriodo(reproduciendo))) && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', opacity: 0.85 }}>
            {texto.mostrarPeriodo && textoPeriodo(reproduciendo) && (
              <span style={{ fontSize: 'clamp(1rem, 2.2vw, 1.35rem)', fontWeight: 800, letterSpacing: '0.5px' }}>
                {textoPeriodo(reproduciendo)}
              </span>
            )}
            {texto.pie && <span style={{ fontSize: '1rem', fontWeight: 600 }}>{texto.pie}</span>}
            {texto.mostrarFecha && (
              <span style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {fechaDeHoy()}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const dibujarDiapositiva = (d?: Diapositiva) => {
    if (!d) return null;
    if (d.tipo === 'portada') return dibujarTexto(d.texto, true);
    if (d.tipo === 'cierre') return dibujarTexto(d.texto, false);
    const componente = COMPONENTES[d.vista];
    if (componente) return componente();
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Info size={44} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)' }}>Módulo no disponible</h3>
        <p style={{ color: 'var(--text-muted)' }}>Esta diapositiva ya no existe en el sistema.</p>
      </div>
    );
  };

  // =====================================================================
  //  MODO PRESENTACIÓN (pantalla completa)
  // =====================================================================
  if (reproduciendo) {
    const actual = diapositivas[Math.min(indice, diapositivas.length - 1)];
    const esPrimera = indice === 0;
    const esUltima = indice >= diapositivas.length - 1;

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        backgroundColor: 'var(--bg-body)', display: 'flex', flexDirection: 'column'
      }}>
        {/* BARRA SUPERIOR */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: '0.7rem 1.25rem', flexShrink: 0,
          backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <Presentation size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {reproduciendo.nombre}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tituloDiapositiva(actual)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
            {textoPeriodo(reproduciendo) && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)',
                border: '1px solid var(--primary)', borderRadius: '999px',
                padding: '0.2rem 0.7rem', whiteSpace: 'nowrap'
              }}>
                <Filter size={12} /> {textoPeriodo(reproduciendo)}
                {reproduciendo.semanas ? ` · ${reproduciendo.semanas} sem` : ''}
              </span>
            )}
            <span style={{
              fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-highlight)', borderRadius: '999px', padding: '0.25rem 0.8rem',
              whiteSpace: 'nowrap'
            }}>
              {indice + 1} / {diapositivas.length}
            </span>
            <button className="btn btn-outline" onClick={alternarPantallaCompleta} style={{ padding: '0.4rem 0.6rem' }} title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}>
              {pantallaCompleta ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="btn btn-outline" onClick={cerrarPresentacion} style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }} title="Salir de la presentación (Esc)">
              <X size={16} /> Salir
            </button>
          </div>
        </div>

        {/* LIENZO: el módulo se dibuja completo, como si fuera la diapositiva */}
        <div id="lienzo-presentacion" style={{ flex: 1, overflowY: 'auto', padding: actual && actual.tipo !== 'vista' ? 0 : '1.75rem 2rem 5.5rem 2rem' }}>
          {/* Todas las diapositivas heredan el mismo filtro inicial */}
          <ContextoFiltroPresentacion.Provider value={filtroActivo}>
            {dibujarDiapositiva(actual)}
          </ContextoFiltroPresentacion.Provider>
        </div>

        {/* FLECHAS LATERALES */}
        <button
          onClick={anterior}
          disabled={esPrimera}
          title="Anterior (←)"
          style={{
            position: 'fixed', left: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px', borderRadius: '50%', zIndex: 2001,
            backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: esPrimera ? 'var(--text-muted)' : 'var(--primary)',
            cursor: esPrimera ? 'not-allowed' : 'pointer', opacity: esPrimera ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}
        >
          <ChevronLeft size={26} />
        </button>
        <button
          onClick={siguiente}
          disabled={esUltima}
          title="Siguiente (→)"
          style={{
            position: 'fixed', right: '14px', top: '50%', transform: 'translateY(-50%)',
            width: '48px', height: '48px', borderRadius: '50%', zIndex: 2001,
            backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)',
            color: esUltima ? 'var(--text-muted)' : 'var(--primary)',
            cursor: esUltima ? 'not-allowed' : 'pointer', opacity: esUltima ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)'
          }}
        >
          <ChevronRight size={26} />
        </button>

        {/* BARRA INFERIOR: avanzar, retroceder y salto directo */}
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2001,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
          padding: '0.7rem 1.25rem', backgroundColor: 'var(--bg-panel)',
          borderTop: '1px solid var(--border)', flexWrap: 'wrap'
        }}>
          <button className="btn btn-outline" onClick={anterior} disabled={esPrimera} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: esPrimera ? 0.45 : 1 }}>
            <ChevronLeft size={16} /> Anterior
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {diapositivas.map((d, i) => (
              <button
                key={`${d.tipo}-${d.tipo === 'vista' ? d.vista : ''}-${i}`}
                onClick={() => setIndice(i)}
                title={tituloDiapositiva(d)}
                style={{
                  width: i === indice ? '26px' : '10px', height: '10px', borderRadius: '999px',
                  border: 'none', cursor: 'pointer', padding: 0,
                  backgroundColor: i === indice ? 'var(--primary)' : 'var(--border)',
                  transition: 'width 0.2s'
                }}
              />
            ))}
          </div>

          <button className="btn btn-primary" onClick={siguiente} disabled={esUltima} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: esUltima ? 0.45 : 1 }}>
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Bloque de edición de una diapositiva de texto (portada o cierre)
  const editorTexto = (
    titulo: string,
    valor: DiapositivaTexto,
    asignar: (v: DiapositivaTexto) => void,
    ayuda: string
  ) => {
    const cambiar = (campo: keyof DiapositivaTexto, dato: string | boolean | string[]) =>
      asignar({ ...valor, [campo]: dato });

    const puntos = valor.puntos || [];
    const cambiarPunto = (i: number, texto: string) => {
      const next = [...puntos];
      next[i] = texto;
      cambiar('puntos', next);
    };
    const agregarPunto = () => cambiar('puntos', [...puntos, '']);
    const quitarPunto = (i: number) => cambiar('puntos', puntos.filter((_, k) => k !== i));

    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div
          onClick={() => cambiar('activa', !valor.activa)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.7rem', cursor: 'pointer',
            padding: '0.7rem 1rem', backgroundColor: 'var(--bg-highlight)'
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
            backgroundColor: valor.activa ? 'var(--primary)' : 'transparent',
            border: `2px solid ${valor.activa ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
          }}>
            {valor.activa && <Check size={13} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{titulo}</strong>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ayuda}</div>
          </div>
        </div>

        {valor.activa && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Título</label>
              <input
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={valor.titulo}
                onChange={e => cambiar('titulo', e.target.value)}
                placeholder={titulo === 'Portada' ? 'Ej: Resultados 2026' : 'Ej: Gracias'}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Subtítulo <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
              <input
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={valor.subtitulo || ''}
                onChange={e => cambiar('subtitulo', e.target.value)}
                placeholder={titulo === 'Portada' ? 'Ej: Junta de gerencia' : 'Ej: ¿Preguntas?'}
              />
            </div>
            {/* VIÑETAS: sirven sobre todo para escribir las conclusiones */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">
                Puntos <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional, uno por línea)</small>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {puntos.map((punto, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      className="form-control"
                      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
                      value={punto}
                      onChange={e => cambiarPunto(i, e.target.value)}
                      placeholder={`Punto ${i + 1}`}
                    />
                    <button onClick={() => quitarPunto(i)} className="btn btn-outline" style={{ padding: '0.35rem', color: 'var(--danger)' }} title="Quitar punto">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={agregarPunto} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.78rem' }}>
                  <ListPlus size={15} /> Agregar punto
                </button>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pie <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
              <input
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={valor.pie || ''}
                onChange={e => cambiar('pie', e.target.value)}
                placeholder="Ej: Preparado por Jesús Molero"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Logo y color del taller <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
              <select
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={valor.taller || ''}
                onChange={e => cambiar('taller', e.target.value)}
              >
                <option value="">Sin logo (color por defecto)</option>
                {talleres.map(tl => <option key={tl.id} value={tl.nombre}>{tl.nombre}</option>)}
              </select>
            </div>
            <div
              onClick={() => cambiar('mostrarPeriodo', !valor.mostrarPeriodo)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                backgroundColor: valor.mostrarPeriodo ? 'var(--primary)' : 'transparent',
                border: `2px solid ${valor.mostrarPeriodo ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
              }}>
                {valor.mostrarPeriodo && <Check size={12} />}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                Mostrar el periodo <small style={{ color: 'var(--text-muted)' }}>(taller · mes · año del filtro)</small>
              </span>
            </div>

            <div
              onClick={() => cambiar('mostrarFecha', !valor.mostrarFecha)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                backgroundColor: valor.mostrarFecha ? 'var(--primary)' : 'transparent',
                border: `2px solid ${valor.mostrarFecha ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
              }}>
                {valor.mostrarFecha && <Check size={12} />}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
                Mostrar la fecha del día <small style={{ color: 'var(--text-muted)' }}>(se calcula al presentar)</small>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =====================================================================
  //  LISTA DE PRESENTACIONES
  // =====================================================================
  return (
    <div className="animate-in fade-in">
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <MonitorPlay size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('vista.presentacion', 'Presentación')}</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Arma una secuencia de módulos y recórrela como diapositivas
            </p>
          </div>
        </div>
        {puedoEditar && (
          <button className="btn btn-primary" onClick={abrirNueva} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Nueva Presentación
          </button>
        )}
      </div>

      {/* AYUDA */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
        padding: '0.85rem 1.1rem', borderRadius: '10px', marginTop: '1.25rem',
        backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)', borderLeft: '4px solid var(--primary)'
      }}>
        <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Durante la presentación cada módulo se muestra completo y con datos en vivo. Avanza con el botón
          <strong style={{ color: 'var(--text-main)' }}> Siguiente</strong> o con las flechas
          <strong style={{ color: 'var(--text-main)' }}> ← →</strong> del teclado, y sal con
          <strong style={{ color: 'var(--text-main)' }}> Esc</strong>.
        </span>
      </div>

      {/* MIGAS DE PAN */}
      {presentacionesOrdenadas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          {(anoAbierto || tallerAbierto || mesAbierto) && (
            <button onClick={subirNivel} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.7rem', fontSize: '0.78rem' }} title="Volver a la carpeta anterior">
              <CornerDownLeft size={14} /> Volver
            </button>
          )}
          <button
            onClick={() => { setAnoAbierto(null); setTallerAbierto(null); setMesAbierto(null); }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: anoAbierto ? 'var(--text-muted)' : 'var(--text-main)' }}
          >
            Presentaciones
          </button>
          {anoAbierto && (
            <>
              <ChevronRight size={14} color="var(--text-muted)" />
              <button
                onClick={() => { setTallerAbierto(null); setMesAbierto(null); }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: tallerAbierto ? 'var(--text-muted)' : 'var(--text-main)' }}
              >
                {anoAbierto}
              </button>
            </>
          )}
          {tallerAbierto && (
            <>
              <ChevronRight size={14} color="var(--text-muted)" />
              <button
                onClick={() => setMesAbierto(null)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: mesAbierto ? 'var(--text-muted)' : 'var(--text-main)' }}
              >
                {tallerAbierto}
              </button>
            </>
          )}
          {mesAbierto && (
            <>
              <ChevronRight size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{mesAbierto}</span>
            </>
          )}
        </div>
      )}

      {/* CARPETAS DEL NIVEL ACTUAL */}
      {presentacionesOrdenadas.length > 0 && !mesAbierto && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          {(!anoAbierto
            ? Array.from(nivelAnos.keys()).sort(ordenarAnos).map(k => ({ k, n: (nivelAnos.get(k) || []).length, abrir: () => setAnoAbierto(k) }))
            : !tallerAbierto
              ? Array.from(nivelTalleres.keys()).sort(ordenarTalleres).map(k => ({ k, n: (nivelTalleres.get(k) || []).length, abrir: () => setTallerAbierto(k) }))
              : Array.from(nivelMeses.keys()).sort(ordenarMeses).map(k => ({ k, n: (nivelMeses.get(k) || []).length, abrir: () => setMesAbierto(k) }))
          ).map(carpeta => (
            <button
              key={carpeta.k}
              onClick={carpeta.abrir}
              className="card"
              style={{
                margin: 0, display: 'flex', alignItems: 'center', gap: '0.85rem',
                textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)'
              }}
            >
              <Folder size={30} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {carpeta.k}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {carpeta.n} {carpeta.n === 1 ? 'presentación' : 'presentaciones'}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* TARJETAS */}
      {presentacionesOrdenadas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
          <MonitorPlay size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Aún no hay presentaciones</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {puedoEditar ? 'Crea una con "Nueva Presentación" y elige los módulos que quieres mostrar.' : 'Pide a un administrador que arme una presentación.'}
          </p>
        </div>
      ) : !mesAbierto ? null : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
          {enMes.map(p => {
            const visibles = p.vistas.filter(v => COMPONENTES[v] && puedeVer(v));
            const totalDiapositivas = armarDiapositivas(p).length;
            const tienePortada = normalizarTexto(p.portada).activa;
            const tieneCierre = normalizarTexto(p.cierre).activa;
            return (
              <div key={p.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>{p.nombre}</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {p.descripcion || `${totalDiapositivas} ${totalDiapositivas === 1 ? 'diapositiva' : 'diapositivas'}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)',
                    border: '1px solid var(--primary)', borderRadius: '999px',
                    padding: '0.15rem 0.6rem', whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    {totalDiapositivas}
                  </span>
                </div>

                {/* Recorrido de la presentación */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {tienePortada && (
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)',
                      backgroundColor: 'rgba(29,140,248,0.12)', border: '1px solid var(--primary)',
                      borderRadius: '6px', padding: '0.2rem 0.5rem'
                    }}>
                      Portada
                    </span>
                  )}
                  {visibles.slice(0, 6).map((v, i) => (
                    <span key={`${v}-${i}`} style={{
                      fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border)',
                      borderRadius: '6px', padding: '0.2rem 0.5rem'
                    }}>
                      {i + 1}. {etiquetaVista(v)}
                    </span>
                  ))}
                  {visibles.length > 6 && (
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)', padding: '0.2rem 0.3rem' }}>
                      +{visibles.length - 6} más
                    </span>
                  )}
                  {tieneCierre && (
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary)',
                      backgroundColor: 'rgba(29,140,248,0.12)', border: '1px solid var(--primary)',
                      borderRadius: '6px', padding: '0.2rem 0.5rem'
                    }}>
                      Cierre
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => presentar(p)} disabled={totalDiapositivas === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: totalDiapositivas === 0 ? 0.5 : 1 }}>
                    <Play size={16} /> Presentar
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => abrirEditar(p)}
                    disabled={!puedoEditar}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }}
                    title={puedoEditar ? 'Editar presentación' : 'Tu rol solo puede consultar'}
                  >
                    <Pencil size={15} /> Editar
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => eliminar(p)}
                    disabled={!puedoEliminar}
                    style={{ padding: '0.5rem 0.7rem', color: 'var(--danger)', opacity: puedoEliminar ? 1 : 0.4, cursor: puedoEliminar ? 'pointer' : 'not-allowed' }}
                    title={puedoEliminar ? 'Eliminar presentación' : 'Tu rol no puede eliminar'}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== EDITOR ===================== */}
      {modalAbierto && (
        <div
          onClick={() => setModalAbierto(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 1rem', overflowY: 'auto' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-in fade-in"
            style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '940px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <MonitorPlay size={22} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
                    {editandoId ? 'Editar Presentación' : 'Nueva Presentación'}
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Elige los módulos y ordénalos como quieras mostrarlos
                  </p>
                </div>
              </div>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline" style={{ padding: '0.4rem', color: 'var(--text-muted)' }} title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ minWidth: 0 }}>
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    placeholder="Ej: Junta mensual de gerencia"
                  />
                </div>
                <div className="form-group" style={{ minWidth: 0 }}>
                  <label className="form-label">Descripción <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                  <input
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Para qué sirve esta presentación"
                  />
                </div>
              </div>

              {/* FILTRO INICIAL: manda sobre todas las diapositivas y ordena la carpeta */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', marginTop: '1.25rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 1rem', backgroundColor: 'var(--bg-highlight)' }}>
                  <Filter size={16} color="var(--primary)" />
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>Filtro de la presentación</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Todas las diapositivas abren con este taller, mes y año. También define la carpeta donde se guarda.
                    </div>
                  </div>
                </div>
                <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Año</label>
                    <input
                      type="number"
                      className="form-control"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      value={filtroAno}
                      onChange={e => setFiltroAno(e.target.value)}
                      placeholder="2026"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Taller</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroTaller} onChange={e => setFiltroTaller(e.target.value)}>
                      <option value="">Todos los talleres</option>
                      {talleres.map(tl => <option key={tl.id} value={tl.nombre}>{tl.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Mes</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                      <option value="">Todo el año</option>
                      {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: 0 }}>
                    <label className="form-label">Semanas</label>
                    <select className="form-control" style={{ width: '100%', boxSizing: 'border-box' }} value={filtroSemanas} onChange={e => setFiltroSemanas(e.target.value)}>
                      <option value="">Sin definir</option>
                      <option value="4">Meses de 4 semanas</option>
                      <option value="5">Meses de 5 semanas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* PORTADA Y CONCLUSIÓN */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                {editorTexto('Portada', portada, setPortada, 'Abre la exposición antes del primer módulo')}
                {editorTexto('Conclusión', cierre, setCierre, 'Cierra la exposición después del último módulo')}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>
                {/* MÓDULOS DISPONIBLES */}
                <div>
                  <h4 className="detail-section-title" style={{ marginTop: 0 }}>Módulos disponibles</h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '420px', overflowY: 'auto' }}>
                    {disponiblesPorGrupo.map(g => (
                      <div key={g.id}>
                        <div style={{ padding: '0.55rem 1rem', backgroundColor: 'var(--bg-highlight)', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {t(g.claveEtiqueta, g.etiqueta)}
                        </div>
                        {g.items.map(i => {
                          const incluida = vistas.includes(i.vista);
                          return (
                            <div
                              key={i.vista}
                              onClick={() => alternarVista(i.vista)}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
                            >
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                                backgroundColor: incluida ? 'var(--primary)' : 'transparent',
                                border: `2px solid ${incluida ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
                              }}>
                                {incluida && <Check size={13} />}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: incluida ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: incluida ? 600 : 400 }}>
                                {t(i.claveEtiqueta, i.etiqueta)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ORDEN DE LAS DIAPOSITIVAS */}
                <div>
                  <h4 className="detail-section-title" style={{ marginTop: 0 }}>
                    Orden de las diapositivas {vistas.length > 0 && <span style={{ color: 'var(--primary)' }}>({vistas.length})</span>}
                  </h4>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', maxHeight: '420px', overflowY: 'auto' }}>
                    {vistas.length === 0 ? (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Marca módulos a la izquierda para agregarlos.
                      </div>
                    ) : (
                      vistas.map((v, i) => (
                        <div
                          key={`${v}-${i}`}
                          draggable
                          onDragStart={() => setArrastrando(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => soltarEn(i)}
                          onDragEnd={() => setArrastrando(null)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                            padding: '0.55rem 0.75rem',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                            backgroundColor: arrastrando === i ? 'var(--bg-highlight)' : 'transparent',
                            cursor: 'grab'
                          }}
                        >
                          <GripVertical size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          <span style={{
                            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                            backgroundColor: 'var(--primary)', color: '#fff',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 800
                          }}>
                            {i + 1}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {etiquetaVista(v)}
                            <small style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{grupoDeVista(v)}</small>
                          </span>
                          <button onClick={() => mover(i, i - 1)} disabled={i === 0} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--text-muted)', opacity: i === 0 ? 0.35 : 1 }} title="Subir">
                            <ArrowUp size={14} />
                          </button>
                          <button onClick={() => mover(i, i + 1)} disabled={i === vistas.length - 1} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--text-muted)', opacity: i === vistas.length - 1 ? 0.35 : 1 }} title="Bajar">
                            <ArrowDown size={14} />
                          </button>
                          <button onClick={() => alternarVista(v)} className="btn btn-outline" style={{ padding: '0.25rem', color: 'var(--danger)' }} title="Quitar de la presentación">
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Arrastra una diapositiva o usa las flechas para cambiar el orden.
                    {(portada.activa || cierre.activa) && ' La portada y el cierre se colocan solos al principio y al final.'}
                  </small>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-outline" onClick={() => setModalAbierto(false)}>
                <X size={16} /> Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || !puedoEditar} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (guardando || !puedoEditar) ? 0.55 : 1 }}>
                <Save size={16} /> {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
