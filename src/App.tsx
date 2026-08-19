import { useContext, useEffect } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EtiquetasProvider } from './context/EtiquetasContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Registros } from './pages/Registros';
import { FormularioRegistro } from './pages/FormularioRegistro';
import { Comparacion } from './pages/Comparacion';
import { ComparacionMeses } from './pages/ComparacionMeses';
import { Talleres } from './pages/Talleres';
import { InspeccionesRegistro } from './pages/InspeccionesRegistro';
import { InspeccionesDashboard } from './pages/InspeccionesDashboard';
import { InspeccionesComparacion } from './pages/InspeccionesComparacion';
import { InspeccionesComparacionMeses } from './pages/InspeccionesComparacionMeses';
import { ReporteAnualGeneral } from './pages/ReporteAnualGeneral';
import { ReporteAnualInspecciones } from './pages/ReporteAnualInspecciones';
import { Usuarios } from './pages/Usuarios';
import { Roles } from './pages/Roles';
import { Personalizacion } from './pages/Personalizacion';
import { MarketingRegistro } from './pages/MarketingRegistro';
import { MarketingDashboard } from './pages/MarketingDashboard';
import { Lock } from 'lucide-react';
import './index.css';

const EnrutadorVistas = () => {
  const contexto = useContext(AppContext);
  const { puedeVer, esAdmin, vistasPermitidas } = useAuth();

  const vista = (contexto?.vista as string) ?? '';

  // Si el usuario cae en una vista que no tiene permitida, se le manda a la
  // primera que sí puede ver. Así nunca queda en una pantalla en blanco.
  useEffect(() => {
    if (!contexto) return;
    // Las vistas de Administración ya se controlan con los permisos del rol
    const permitida = puedeVer(vista);
    if (!permitida) {
      const destino = esAdmin ? 'dashboard' : vistasPermitidas[0];
      if (destino && destino !== vista) {
        (contexto.setVista as (v: any) => void)(destino);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, esAdmin, vistasPermitidas.join(',')]);

  if (!contexto) return null;

  const puedeAbrir = puedeVer(vista);

  return (
    <Layout>
      {!puedeAbrir ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Lock size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Sin acceso a esta sección</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Tu rol no tiene permiso para verla. Si crees que es un error, contacta al administrador.
          </p>
        </div>
      ) : (
        <>
          {vista === 'dashboard' && <Dashboard />}
          {vista === 'tabla' && <Registros />}
          {vista === 'formulario' && <FormularioRegistro />}
          {vista === 'comparacion' && <Comparacion />}
          {vista === 'comparacionMeses' && <ComparacionMeses />}
          {vista === 'talleres' && <Talleres />}
          {vista === 'inspeccionesRegistro' && <InspeccionesRegistro />}
          {vista === 'inspeccionesDashboard' && <InspeccionesDashboard />}
          {vista === 'inspeccionesComparacion' && <InspeccionesComparacion />}
          {vista === 'inspeccionesComparacionMeses' && <InspeccionesComparacionMeses />}
          {vista === 'reporteAnualGeneral' && <ReporteAnualGeneral />}
          {vista === 'reporteAnualInspecciones' && <ReporteAnualInspecciones />}
          {vista === 'usuarios' && <Usuarios />}
          {vista === 'roles' && <Roles />}
          {vista === 'personalizacion' && <Personalizacion />}
          {vista === 'marketing' && <MarketingRegistro />}
          {vista === 'marketingDashboard' && <MarketingDashboard />}
        </>
      )}
    </Layout>
  );
};

// Pantalla de carga mientras se resuelve la sesión
const Cargando = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    color: '#94a3b8', fontWeight: 600, fontSize: '0.9rem'
  }}>
    Cargando...
  </div>
);

// Decide si mostrar el login o la aplicación
const PuertaDeAcceso = () => {
  const { usuarioAuth, perfil, cargando, accesoSinLogin } = useAuth();

  if (cargando) return <Cargando />;
  // Se entra con sesión iniciada o con el acceso temporal sin login
  if (!accesoSinLogin && (!usuarioAuth || !perfil)) return <Login />;

  return (
    <AppProvider>
      <EnrutadorVistas />
    </AppProvider>
  );
};

export default function App() {
  return (
    <EtiquetasProvider>
      <AuthProvider>
        <PuertaDeAcceso />
      </AuthProvider>
    </EtiquetasProvider>
  );
}
