import { useState, useContext, type ReactNode } from 'react';
import { AppContext } from '../../context/AppContext';
import { Calendar, PieChart, FileText, Users, Menu, ChevronLeft, ChevronRight, GitCompare, Store } from 'lucide-react'; // Importamos Store

export const Layout = ({ children }: { children: ReactNode }) => {
  const contexto = useContext(AppContext);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!contexto) return null;

  return (
    <div className="app-layout">
      {menuAbierto && <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} className="md-hidden" onClick={() => setMenuAbierto(false)} />}

      <aside className={`sidebar ${menuAbierto ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-box"><Calendar size={20} /></div>
          <h2>Sistema Metas</h2>
        </div>

        <ul className="nav-menu">

        
          <li className={`nav-item ${contexto.vista === 'tabla' || contexto.vista === 'formulario' ? 'active' : ''}`} onClick={() => { contexto.setVista('tabla'); setMenuAbierto(false); }} title="Registros">
            <FileText size={18} /><span>Registros</span>
          </li>

            <li className={`nav-item ${contexto.vista === 'dashboard' ? 'active' : ''}`} onClick={() => { contexto.setVista('dashboard'); setMenuAbierto(false); }} title="Dashboard">
            <PieChart size={18} /><span>Dashboard</span>
          </li>
          
          <li className={`nav-item ${contexto.vista === 'comparacion' ? 'active' : ''}`} onClick={() => { contexto.setVista('comparacion'); setMenuAbierto(false); }} title="Comparación">
            <GitCompare size={18} /><span>Comparación</span>
          </li>
          
          {/* NUEVO MÓDULO: Talleres reemplaza a Actividad */}
          <li className={`nav-item ${contexto.vista === 'talleres' ? 'active' : ''}`} onClick={() => { contexto.setVista('talleres'); setMenuAbierto(false); }} title="Talleres">
            <Store size={18} /><span>Talleres</span>
          </li>
          
          <li className="nav-item" title="Usuarios">
            <Users size={18} /><span>Usuarios</span>
          </li>
        </ul>

        <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? "Expandir" : "Colapsar"}>
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </aside>

      <main className="main-content">
        <header style={{ padding: '1rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'none' }} className="md-block">
          <button className="btn btn-outline" style={{padding: '0.4rem'}} onClick={() => setMenuAbierto(!menuAbierto)}><Menu size={24}/></button>
        </header>
        <div className="content-area">{children}</div>
      </main>
    </div>
  );
};