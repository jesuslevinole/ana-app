import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  PRESENTACIONES
//
//  Una presentación es una lista ORDENADA de vistas de la aplicación. Al
//  reproducirla, cada vista se muestra a pantalla completa como si fuera una
//  diapositiva y se avanza con los botones o con las flechas del teclado.
//
//  Se guardan en Firestore (colección "presentaciones") para que todos los
//  usuarios vean las mismas presentaciones armadas por la gerencia.
// =========================================================================

export interface Presentacion {
  id: string;
  nombre: string;
  descripcion?: string;
  vistas: string[];        // orden de las diapositivas (claves de vista)
  creadoEn?: string;
  actualizadoEn?: string;
}

// Id legible a partir del nombre (mismo criterio que Roles)
export const idDesdeNombre = (nombre: string) =>
  nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `presentacion-${Date.now()}`;

export const usePresentaciones = () => {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'presentaciones'),
      (snapshot) => {
        const data = snapshot.docs.map(d => {
          const bruto = d.data() as Partial<Presentacion>;
          return {
            ...bruto,
            id: d.id,
            nombre: bruto.nombre || d.id,
            vistas: Array.isArray(bruto.vistas) ? bruto.vistas : [],
          } as Presentacion;
        });
        setPresentaciones(data);
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'presentaciones' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const guardarPresentacion = async (p: Presentacion) => {
    try {
      await setDoc(doc(db, 'presentaciones', p.id), {
        nombre: p.nombre,
        descripcion: p.descripcion || '',
        vistas: p.vistas,
        creadoEn: p.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error al guardar la presentación:', error);
      alert('No se pudo guardar la presentación. Revisa la consola.');
    }
  };

  const eliminarPresentacion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'presentaciones', id));
    } catch (error) {
      console.error('Error al eliminar la presentación:', error);
    }
  };

  return { presentaciones, cargando, guardarPresentacion, eliminarPresentacion };
};
