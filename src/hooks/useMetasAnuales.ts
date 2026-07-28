import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  METAS ANUALES POR TALLER (compartidas para todos los usuarios)
//  Se guardan en Firestore en el documento config/metasAnuales con la forma:
//
//  {
//    ventas:       { "2026": { "TALLER A": 500000, "TALLER B": 380000 } },
//    inspecciones: { "2026": { "TALLER A": 1800,   "TALLER B": 1450   } }
//  }
//
//  "ventas"       -> meta anual del módulo Taller (monto en dólares)
//  "inspecciones" -> meta anual del módulo Inspecciones (cantidad)
// =========================================================================

export type AmbitoMeta = 'ventas' | 'inspecciones';

// { [ano]: { [taller]: meta } }
export type MetasPorAno = Record<string, Record<string, number>>;

export type MetasAnuales = {
  ventas: MetasPorAno;
  inspecciones: MetasPorAno;
};

const VACIO: MetasAnuales = { ventas: {}, inspecciones: {} };

// Normaliza lo que venga de Firestore para evitar valores corruptos
const normalizar = (data: any): MetasAnuales => {
  const limpiarAmbito = (bruto: any): MetasPorAno => {
    if (!bruto || typeof bruto !== 'object') return {};
    const salida: MetasPorAno = {};
    Object.keys(bruto).forEach(ano => {
      const porTaller = bruto[ano];
      if (!porTaller || typeof porTaller !== 'object') return;
      const limpio: Record<string, number> = {};
      Object.keys(porTaller).forEach(taller => {
        const v = Number(porTaller[taller]);
        if (Number.isFinite(v) && v >= 0) limpio[taller] = v;
      });
      salida[ano] = limpio;
    });
    return salida;
  };
  return {
    ventas: limpiarAmbito(data?.ventas),
    inspecciones: limpiarAmbito(data?.inspecciones)
  };
};

export const useMetasAnuales = () => {
  const [metasAnuales, setMetasAnuales] = useState<MetasAnuales>(VACIO);
  const [cargando, setCargando] = useState<boolean>(true);

  // Suscripción en tiempo real: si otro usuario cambia una meta, se refleja aquí
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'config', 'metasAnuales'),
      (snap) => {
        setMetasAnuales(normalizar(snap.data()));
        setCargando(false);
      },
      (error) => {
        console.error("🔥 Error al leer 'config/metasAnuales' de Firebase:", error);
        setCargando(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Meta anual establecida para un taller concreto (0 si no está definida)
  const obtenerMetaAnual = (ambito: AmbitoMeta, ano: string, taller: string): number => {
    const v = metasAnuales[ambito]?.[ano]?.[taller];
    return Number.isFinite(v) && (v as number) >= 0 ? (v as number) : 0;
  };

  // Suma de las metas anuales de TODOS los talleres del año (consolidado global)
  const totalMetaAnualDelAno = (ambito: AmbitoMeta, ano: string): number => {
    const porTaller = metasAnuales[ambito]?.[ano];
    if (!porTaller) return 0;
    return Object.values(porTaller).reduce((acc, v) => acc + (Number(v) || 0), 0);
  };

  // Guarda (o borra, si el valor es 0 o vacío) la meta anual de un taller
  const guardarMetaAnual = async (ambito: AmbitoMeta, ano: string, taller: string, valor: number) => {
    if (!taller) return;
    const limpio = Number.isFinite(valor) && valor > 0 ? valor : 0;
    const actualAmbito = metasAnuales[ambito] ?? {};
    const actualAno = { ...(actualAmbito[ano] ?? {}) };
    if (limpio > 0) {
      actualAno[taller] = limpio;
    } else {
      delete actualAno[taller];
    }
    const payload = { [ambito]: { ...actualAmbito, [ano]: actualAno } };
    try {
      await setDoc(doc(db, 'config', 'metasAnuales'), payload, { merge: true });
    } catch (error) {
      console.error('Error al guardar la meta anual:', error);
      alert('Error al guardar la meta anual en Firebase. Revisa la consola.');
    }
  };

  return { metasAnuales, cargando, obtenerMetaAnual, totalMetaAnualDelAno, guardarMetaAnual };
};