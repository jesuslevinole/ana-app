import { createContext, useState, useEffect, type ReactNode } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Registro, AppContextType, VistaApp, Taller } from '../types';

export const AppContext = createContext<AppContextType | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [talleres, setTalleres] = useState<Taller[]>([]);
  const [vista, setVista] = useState<VistaApp>('talleres'); // Iniciamos en talleres para que veas el cambio
  const [registroEditando, setRegistroEditando] = useState<Registro | null>(null);

  // Escuchar cambios en tiempo real desde Firestore
  useEffect(() => {
    // Suscripción a Registros
    const unsubscribeRegistros = onSnapshot(collection(db, 'registros'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Registro));
      setRegistros(data);
    }, (error) => {
      console.error("🔥 Error al leer 'registros' de Firebase:", error);
    });

    // Suscripción a Talleres (Robustecida)
    const unsubscribeTalleres = onSnapshot(collection(db, 'talleres'), (snapshot) => {
      console.log("📥 Datos recibidos de Firebase (Talleres):", snapshot.docs.length);
      
      const data = snapshot.docs
        .map(doc => {
          const docData = doc.data();
          // Asegurarnos de que el documento tenga los campos mínimos requeridos
          if (docData.nombre && docData.logo) {
            return { ...docData, id: doc.id } as Taller;
          }
          console.warn("⚠️ Documento de taller ignorado por estar incompleto:", doc.id, docData);
          return null;
        })
        .filter((taller): taller is Taller => taller !== null); // Filtramos los nulos
        
      setTalleres(data);
    }, (error) => {
      console.error("🔥 Error al leer 'talleres' de Firebase:", error);
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
      console.error("Error al guardar el registro:", error);
      alert("Error al guardar en Firebase. Revisa la consola.");
    }
  };

  const eliminarRegistro = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registros', id));
    } catch (error) {
      console.error("Error al eliminar el registro:", error);
    }
  };

  const agregarTaller = async (nuevoTaller: Taller) => {
    try {
      console.log("⬆️ Enviando taller a Firebase...", nuevoTaller);
      await setDoc(doc(db, 'talleres', nuevoTaller.id), nuevoTaller);
      // El aviso fue eliminado para evitar el spam al reordenar la tabla
    } catch (error) {
      console.error("Error al guardar el taller:", error);
      alert("Error al guardar en Firebase. Revisa la consola.");
    }
  };

  const eliminarTaller = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'talleres', id));
    } catch (error) {
      console.error("Error al eliminar el taller:", error);
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