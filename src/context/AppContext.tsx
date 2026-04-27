import { createContext, useState, type ReactNode } from 'react';
import type { Registro, AppContextType, VistaApp, Taller } from '../types';

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]); // Estado de Talleres
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [registroEditando, setRegistroEditando] = useState<Registro | null>(null);

  const agregarRegistro = (nuevoRegistro: Registro) => {
    setRegistros(prev => {
      const existe = prev.find(r => r.id === nuevoRegistro.id);
      if (existe) return prev.map(r => r.id === nuevoRegistro.id ? nuevoRegistro : r);
      return [nuevoRegistro, ...prev];
    });
    setVista('tabla');
    setRegistroEditando(null);
  };

  const eliminarRegistro = (id: string) => {
    setRegistros(prev => prev.filter(r => r.id !== id));
  };

  // Funciones CRUD para Talleres
  const agregarTaller = (nuevoTaller: Taller) => {
    setTalleres(prev => [nuevoTaller, ...prev]);
  };

  const eliminarTaller = (id: string) => {
    setTalleres(prev => prev.filter(t => t.id !== id));
  };

  return (
    <AppContext.Provider value={{ 
      registros, agregarRegistro, eliminarRegistro, registroEditando, setRegistroEditando, 
      talleres, agregarTaller, eliminarTaller, // Inyectamos talleres al contexto
      vista, setVista 
    }}>
      {children}
    </AppContext.Provider>
  );
};