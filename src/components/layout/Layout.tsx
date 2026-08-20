import { useState, useContext, useEffect, Fragment, type ReactNode } from 'react';
import { AppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEtiquetas } from '../../context/EtiquetasContext';
import { CATALOGO_NAVEGACION } from '../../config/navegacion';
import { TextoEditable } from '../TextoEditable';
import { BarraHerramientas } from '../BarraHerramientas';
import {
  Calendar, PieChart, FileText, Menu, ChevronLeft, ChevronRight,
  GitCompare, Store, ChevronDown, Wrench, ClipboardCheck, Megaphone, Clock,
  ClipboardList, LineChart, Sun, Moon, CalendarRange, FileBarChart,
  Settings, Users, ShieldCheck, Type, LogOut, AlertTriangle,
  BarChart3, MonitorPlay, Presentation, DollarSign
} from 'lucide-react';

// Clave de almacenamiento del tema elegido (claro / oscuro)
const STORAGE_TEMA = 'app_tema_v1';

// Mapa de iconos: el catálogo guarda el nombre y aquí se resuelve el componente
const ICONOS: Record<string, React.ComponentType<{ size?: number }>> = {
  Wrench, PieChart, FileText, GitCompare, Store, CalendarRange,
  ClipboardCheck, ClipboardList, LineChart, FileBarChart, Megaphone, Clock,
  Settings, Users, ShieldCheck, Type, BarChart3, MonitorPlay, Presentation, DollarSign,
};

const iconoDe = (nombre: string) => ICONOS[nombre] || FileText;

export const Layout = ({ children }: { children: ReactNode }) => {
  const contexto = useContext(AppContext);
  const { perfil, rol, puedeVer, cerrarSesion, accesoSinLogin } = useAuth();
  const { t } = useEtiquetas();

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // --- TEMA CLARO / OSCURO (persistente) ---
  const [tema, setTema] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem(STORAGE_TEMA) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(STORAGE_TEMA, tema); } catch { /* almacenamiento no disponible */ }
  }, [tema]);

  const alternarTema = () => setTema(anterior => (anterior === 'dark' ? 'light' : 'dark'));

  const vistaActual = (contexto?.vista as string) ?? '';

  // --- MENÚ FILTRADO SEGÚN LOS PERMISOS DEL ROL ---
  // Cada grupo conserva solo las vistas que el usuario puede ver; los grupos
  // que se quedan sin vistas no se muestran.
  const gruposVisibles = CATALOGO_NAVEGACION
    .map(g => ({
      ...g,
      items: g.items.filter(i => puedeVer(i.vista)),
    }))
    .filter(g => g.items.length > 0);

  const grupoDeVista = (v: string) =>
    gruposVisibles.find(g => g.items.some(i => i.vista === v || i.extra?.includes(v)))?.id;

  const [abierto, setAbierto] = useState<string | null>(grupoDeVista(vistaActual) ?? 'taller');

  useEffect(() => {
    const g = grupoDeVista(vistaActual);
    if (g) setAbierto(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaActual]);

  if (!contexto) return null;

  const ir = (vista: string) => {
    (contexto.setVista as (v: any) => void)(vista);
    setMenuAbierto(false);
  };

  const itemActivo = (item: { vista: string; extra?: string[] }) =>
    vistaActual === item.vista || (item.extra?.includes(vistaActual) ?? false);

  // Iniciales del usuario para el avatar
  const iniciales = (perfil?.nombre || '?')
    .split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <div className="app-layout">
      {menuAbierto && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          className="md-hidden"
          onClick={() => setMenuAbierto(false)}
        />
      )}

      <aside className={`sidebar ${menuAbierto ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box"><Calendar size={20} /></div>
          <h2><TextoEditable clave="app.nombre" defecto="Sistema Metas" /></h2>
        </div>

        <ul className="nav-menu">
          {gruposVisibles.map(grupo => {
            const Icono = iconoDe(grupo.icono);
            const grupoActivo = grupo.items.some(itemActivo);
            const estaAbierto = abierto === grupo.id;
            const mostrarItems = estaAbierto || sidebarCollapsed;

            return (
              <Fragment key={grupo.id}>
                {/* ENCABEZADO DEL GRUPO */}
                <li
                  className={`nav-item ${grupoActivo ? 'active' : ''}`}
                  onClick={() => setAbierto(estaAbierto ? null : grupo.id)}
                  title={t(grupo.claveEtiqueta, grupo.etiqueta)}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? 0 : '0.75rem', justifyContent: 'center' }}>
                    <Icono size={18} /><TextoEditable clave={grupo.claveEtiqueta} defecto={grupo.etiqueta} />
                  </span>
                  {!sidebarCollapsed && (
                    <ChevronDown
                      size={16}
                      style={{ transform: estaAbierto ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.25s', flexShrink: 0 }}
                    />
                  )}
                </li>

                {/* SUBMENÚ */}
                <div style={{ overflow: 'hidden', maxHeight: mostrarItems ? `${grupo.items.length * 52 + 8}px` : '0px', transition: 'max-height 0.3s ease' }}>
                  {grupo.items.map(item => {
                    const ItemIcono = iconoDe(item.icono);
                    const activo = itemActivo(item);
                    return (
                      <li
                        key={`${grupo.id}-${item.vista}`}
                        className={`nav-item ${activo ? 'active' : ''}`}
                        title={t(item.claveEtiqueta, item.etiqueta)}
                        onClick={() => ir(item.vista)}
                        style={{
                          paddingLeft: sidebarCollapsed ? undefined : '2.5rem',
                          justifyContent: sidebarCollapsed ? 'center' : undefined,
                        }}
                      >
                        <ItemIcono size={16} /><TextoEditable clave={item.claveEtiqueta} defecto={item.etiqueta} />
                      </li>
                    );
                  })}
                </div>
              </Fragment>
            );
          })}
        </ul>

        {/* USUARIO CONECTADO */}
        {perfil && (
          <div style={{
            marginTop: 'auto', padding: sidebarCollapsed ? '0.75rem 0.5rem' : '0.85rem 1rem',
            borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center',
            gap: '0.65rem', justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
          }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: '0.78rem'
            }}>
              {iniciales}
            </span>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {perfil.nombre}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rol?.nombre || 'Sin rol'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CERRAR SESIÓN */}
        <button
          className="sidebar-toggle-btn"
          style={{ marginTop: perfil ? 0 : 'auto', borderTop: '1px solid var(--border)' }}
          onClick={() => { if (confirm(accesoSinLogin ? '¿Salir y volver a la pantalla de acceso?' : '¿Cerrar sesión?')) cerrarSesion(); }}
          title={accesoSinLogin ? 'Salir' : 'Cerrar sesión'}
        >
          <LogOut size={20} />
          {!sidebarCollapsed && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{accesoSinLogin ? 'Salir' : 'Cerrar sesión'}</span>
          )}
        </button>

        {/* TEMA CLARO / OSCURO */}
        <button
          className="sidebar-toggle-btn"
          style={{ marginTop: 0, borderTop: '1px solid var(--border)' }}
          onClick={alternarTema}
          title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          {!sidebarCollapsed && (
            <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>
              {tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          )}
        </button>

        <button
          className="sidebar-toggle-btn"
          style={{ marginTop: 0 }}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      <main className="main-content">
        <header
          style={{ padding: '1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'none' }}
          className="md-block"
        >
          <button className="btn btn-outline" style={{ padding: '0.4rem' }} onClick={() => setMenuAbierto(!menuAbierto)}>
            <Menu size={24} />
          </button>
        </header>
        {/* AVISO: se está navegando sin haber iniciado sesión */}
        {accesoSinLogin && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            padding: '0.45rem 1rem', backgroundColor: '#ffbc11', color: '#111827',
            fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.3px'
          }}>
            <AlertTriangle size={15} />
            Estás navegando sin iniciar sesión (acceso temporal de desarrollo)
          </div>
        )}
        <div className="content-area">{children}</div>
      </main>

      {/* Herramientas de administración: modo edición y "Ver como" */}
      <BarraHerramientas />
    </div>
  );
};
