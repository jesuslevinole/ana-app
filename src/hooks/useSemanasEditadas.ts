import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  SEMANAS EDITADAS MANUALMENTE (compartidas para todos los usuarios)
//
//  Antes se guardaban solo en localStorage, por lo que la edición se perdía
//  al cambiar de navegador o de equipo. Ahora se guardan en Firestore en el
//  documento config/semanasEditadas con la forma:
//
//    { "2026__QUEEN'S CHAPEL AUTO REPAIR LLC__Julio": 5, ... }
//
//  Se mantiene una copia en localStorage como respaldo, para que la tabla
//  muestre los valores al instante mientras Firestore responde y para no
//  perder nada si la conexión falla.
// =========================================================================

const STORAGE_SEMANAS = 'roelca_semanas_editadas_v1';

export type SemanasEditadas = Record<string, number>;

// Firestore no admite puntos, barras ni corchetes en los nombres de campo,
// así que la clave se codifica antes de guardar y se decodifica al leer.
const codificarClave = (k: string) => encodeURIComponent(k).replace(/\./g, '%2E');
const decodificarClave = (k: string) => {
  try { return decodeURIComponent(k); } catch { return k; }
};

const leerRespaldoLocal = (): SemanasEditadas => {
  try {
    const raw = localStorage.getItem(STORAGE_SEMANAS);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
};

export const useSemanasEditadas = () => {
  const [semanasEditadas, setSemanasEditadas] = useState<SemanasEditadas>(() => leerRespaldoLocal());
  // Evita que la primera respuesta de Firestore borre una edición recién hecha
  const guardandoRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'semanasEditadas'),
      (snap) => {
        if (guardandoRef.current) return; // hay una escritura propia en curso
        const data = snap.data();
        if (!data) return;
        const limpio: SemanasEditadas = {};
        Object.keys(data).forEach(k => {
          const v = Number(data[k]);
          if (Number.isFinite(v) && v >= 0) limpio[decodificarClave(k)] = v;
        });
        setSemanasEditadas(limpio);
        try { localStorage.setItem(STORAGE_SEMANAS, JSON.stringify(limpio)); } catch { /* no disponible */ }
      },
      (error) => {
        console.error("🔥 Error al leer 'config/semanasEditadas' de Firebase:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Guarda el número de semanas de una clave (año__taller__mes)
  const guardarSemanas = async (clave: string, valor: number) => {
    const limpio = Number.isFinite(valor) && valor >= 0 ? Math.floor(valor) : 0;
    // 1) Actualización optimista: la tabla responde de inmediato
    setSemanasEditadas(prev => {
      const next = { ...prev, [clave]: limpio };
      try { localStorage.setItem(STORAGE_SEMANAS, JSON.stringify(next)); } catch { /* no disponible */ }
      return next;
    });
    // 2) Persistencia en Firestore (merge: solo toca esta clave)
    guardandoRef.current = true;
    try {
      await setDoc(doc(db, 'config', 'semanasEditadas'), { [codificarClave(clave)]: limpio }, { merge: true });
    } catch (error) {
      console.error('Error al guardar las semanas del mes:', error);
    } finally {
      guardandoRef.current = false;
    }
  };

  return { semanasEditadas, guardarSemanas };
};