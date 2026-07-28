import { useContext } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import { Layout } from './components/layout/Layout';
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
import { Marketing } from './pages/Marketing';
import "./index.css";

const EnrutadorVistas = () => {
  const contexto = useContext(AppContext);
  if (!contexto) return null;

  // Casteo a string para admitir las vistas nuevas sin tocar el tipo VistaApp
  // (aunque se recomienda extenderlo, ver nota).
  const vista = contexto.vista as string;

  return (
    <Layout>
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
      {vista === 'marketing' && <Marketing />}
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <EnrutadorVistas />
    </AppProvider>
  );
}