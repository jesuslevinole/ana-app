import { useState, useMemo, useEffect, useCallback, useContext, type ReactNode } from 'react';
import { CATALOGO_NAVEGACION, TODAS_LAS_VISTAS } from '../config/navegacion';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import { usePresentaciones, idDesdeNombre, type Presentacion as TipoPresentacion } from '../hooks/usePresentaciones';

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
  ArrowUp, ArrowDown, Check, GripVertical, Maximize2, Minimize2, Info, Presentation
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

export const Presentacion = () => {
  const contexto = useContext(AppContext);
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
  //  EDITOR
  // =====================================================================
  const abrirNueva = () => {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setVistas([]);
    setModalAbierto(true);
  };

  const abrirEditar = (p: TipoPresentacion) => {
    setEditandoId(p.id);
    setNombre(p.nombre);
    setDescripcion(p.descripcion || '');
    setVistas([...p.vistas]);
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
    if (vistas.length === 0) { alert('Agrega al menos un módulo a la presentación.'); return; }
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
  // Diapositivas realmente visibles para quien presenta
  const diapositivas = useMemo(
    () => (reproduciendo ? reproduciendo.vistas.filter(v => COMPONENTES[v] && puedeVer(v)) : []),
    [reproduciendo, puedeVer]
  );

  const presentar = (p: TipoPresentacion) => {
    const utiles = p.vistas.filter(v => COMPONENTES[v] && puedeVer(v));
    if (utiles.length === 0) {
      alert('Esta presentación no tiene módulos que puedas ver.');
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

  // =====================================================================
  //  MODO PRESENTACIÓN (pantalla completa)
  // =====================================================================
  if (reproduciendo) {
    const vistaActual = diapositivas[Math.min(indice, diapositivas.length - 1)];
    const dibujar = COMPONENTES[vistaActual];
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
                {grupoDeVista(vistaActual)} · {etiquetaVista(vistaActual)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
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
        <div id="lienzo-presentacion" style={{ flex: 1, overflowY: 'auto', padding: '1.75rem 2rem 5.5rem 2rem' }}>
          {dibujar ? dibujar() : (
            <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <Info size={44} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--text-main)' }}>Módulo no disponible</h3>
              <p style={{ color: 'var(--text-muted)' }}>Esta diapositiva ya no existe en el sistema.</p>
            </div>
          )}
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
            {diapositivas.map((v, i) => (
              <button
                key={`${v}-${i}`}
                onClick={() => setIndice(i)}
                title={etiquetaVista(v)}
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

      {/* TARJETAS */}
      {presentacionesOrdenadas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', marginTop: '1.5rem' }}>
          <MonitorPlay size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Aún no hay presentaciones</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {puedoEditar ? 'Crea una con "Nueva Presentación" y elige los módulos que quieres mostrar.' : 'Pide a un administrador que arme una presentación.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
          {presentacionesOrdenadas.map(p => {
            const visibles = p.vistas.filter(v => COMPONENTES[v] && puedeVer(v));
            return (
              <div key={p.id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.05rem' }}>{p.nombre}</h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {p.descripcion || `${visibles.length} ${visibles.length === 1 ? 'diapositiva' : 'diapositivas'}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)',
                    border: '1px solid var(--primary)', borderRadius: '999px',
                    padding: '0.15rem 0.6rem', whiteSpace: 'nowrap', flexShrink: 0
                  }}>
                    {visibles.length}
                  </span>
                </div>

                {/* Recorrido de la presentación */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
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
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => presentar(p)} disabled={visibles.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: visibles.length === 0 ? 0.5 : 1 }}>
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
