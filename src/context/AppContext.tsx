import { createContext, useState, useEffect, type ReactNode } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Registro, AppContextType, VistaApp, Taller } from '../types';

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [vista, setVista] = useState<VistaApp>('dashboard');
  const [registroEditando, setRegistroEditando] = useState<Registro | null>(null);

  // Escuchar cambios en tiempo real desde Firestore
  useEffect(() => {
    const unsubscribeRegistros = onSnapshot(collection(db, 'registros'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Registro));
      setRegistros(data);
    }, (error) => {
      console.error("Error al obtener registros: ", error);
    });

    const unsubscribeTalleres = onSnapshot(collection(db, 'talleres'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Taller));
      setTalleres(data);
    }, (error) => {
      console.error("Error al obtener talleres: ", error);
    });

    return () => {
      unsubscribeRegistros();
      unsubscribeTalleres();
    };
  }, []);

  const agregarRegistro = async (nuevoRegistro: Registro) => {
    try {
      await setDoc(doc(db, 'registros', nuevoRegistro.id), nuevoRegistro);
      setVista('tabla');
      setRegistroEditando(null);
    } catch (error) {
      console.error("Error al guardar el registro: ", error);
    }
  };

  const eliminarRegistro = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registros', id));
    } catch (error) {
      console.error("Error al eliminar el registro: ", error);
    }
  };

  const agregarTaller = async (nuevoTaller: Taller) => {
    try {
      await setDoc(doc(db, 'talleres', nuevoTaller.id), nuevoTaller);
    } catch (error) {
      console.error("Error al guardar el taller: ", error);
    }
  };

  const eliminarTaller = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'talleres', id));
    } catch (error) {
      console.error("Error al eliminar el taller: ", error);
    }
  };

  return (
    <AppContext.Provider value={{ 
      registros, agregarRegistro, eliminarRegistro, registroEditando, setRegistroEditando, 
      talleres, agregarTaller, eliminarTaller,
      vista, setVista 
    }}>
      {children}
    </AppContext.Provider>
  );
};