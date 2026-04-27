import { useContext } from 'react';
import { AppProvider, AppContext } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Registros } from './pages/Registros';
import { FormularioRegistro } from './pages/FormularioRegistro';
import { Comparacion } from './pages/Comparacion';
import { Talleres } from './pages/Talleres'; // <-- IMPORTA EL NUEVO MÓDULO
import "./index.css";

const EnrutadorVistas = () => {
  const contexto = useContext(AppContext);
  if (!contexto) return null;

  return (
    <Layout>
      {contexto.vista === 'dashboard' && <Dashboard />}
      {contexto.vista === 'tabla' && <Registros />}
      {contexto.vista === 'formulario' && <FormularioRegistro />}
      {contexto.vista === 'comparacion' && <Comparacion />}
      {contexto.vista === 'talleres' && <Talleres />} {/* <-- RENDERIZA AQUÍ */}
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