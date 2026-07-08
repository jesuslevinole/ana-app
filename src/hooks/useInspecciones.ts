import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Un documento = inspecciones de un taller en un mes/año concreto
export interface Inspeccion {
  id: string;        // `${taller}__${ano}__${mes}`
  taller: string;    // nombre del taller
  ano: number;
  mes: string;       // nombre del mes (debe coincidir con MESES)
  cantidad: number;  // número de inspecciones del mes
  costo?: number;    // costo por inspección
  total?: number;    // cantidad × costo
  meta?: number;     // meta programada de inspecciones del mes
  semanas?: number;  // semanas del mes (4 o 5)
}

export const idInspeccion = (taller: string, ano: number | string, mes: string) =>
  `${taller}__${ano}__${mes}`;

export const useInspecciones = () => {
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([]);
  const [cargando, setCargando] = useState(true);

  // Escucha en tiempo real, igual que registros/talleres en AppContext
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'inspecciones'),
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Inspeccion));
        setInspecciones(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'inspecciones' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarInspeccion = async (insp: Inspeccion) => {
    try {
      await setDoc(doc(db, 'inspecciones', insp.id), insp);
    } catch (error) {
      console.error("Error al guardar la inspección:", error);
      alert("Error al guardar en Firebase. Revisa la consola.");
    }
  };

  const eliminarInspeccion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inspecciones', id));
    } catch (error) {
      console.error("Error al eliminar la inspección:", error);
    }
  };

  return { inspecciones, cargando, guardarInspeccion, eliminarInspeccion };
};