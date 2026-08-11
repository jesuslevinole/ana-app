import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// =========================================================================
//  ETIQUETAS PERSONALIZABLES
//
//  Permite al administrador renombrar los textos de la aplicación (nombres
//  del menú, términos del negocio, acciones) sin tocar el código.
//
//  Se guardan en Firestore en config/etiquetas con la forma:
//    { "vista.dashboard": "Panel de control", "termino.taller": "Sucursal" }
//
//  Las claves llevan punto, que Firestore interpreta como ruta anidada, así
//  que se codifican antes de guardar y se decodifican al leer.
// =========================================================================

const codificar = (k: string) => k.replace(/\./g, '__');
const decodificar = (k: string) => k.replace(/__/g, '.');

export interface EtiquetasContextType {
  etiquetas: Record<string, string>;
  cargando: boolean;
  // Modo edición: cuando está activo, los textos envueltos en <TextoEditable>
  // muestran un lápiz para renombrarlos en el momento.
  modoEdicion: boolean;
  setModoEdicion: (v: boolean) => void;
  // Devuelve la etiqueta personalizada o el texto por defecto
  t: (clave: string, porDefecto: string) => string;
  guardarEtiqueta: (clave: string, valor: string) => Promise<void>;
  guardarVarias: (cambios: Record<string, string>) => Promise<void>;
  restablecer: (clave: string) => Promise<void>;
}

export const EtiquetasContext = createContext<EtiquetasContextType | null>(null);

export const useEtiquetas = () => {
  const ctx = useContext(EtiquetasContext);
  // Si se usa fuera del proveedor, se devuelven los textos por defecto para
  // que la app siga funcionando en lugar de romperse.
  if (!ctx) {
    return {
      etiquetas: {},
      cargando: false,
      modoEdicion: false,
      setModoEdicion: () => {},
      t: (_clave: string, porDefecto: string) => porDefecto,
      guardarEtiqueta: async () => {},
      guardarVarias: async () => {},
      restablecer: async () => {},
    } as EtiquetasContextType;
  }
  return ctx;
};

export const EtiquetasProvider = ({ children }: { children: ReactNode }) => {
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState<boolean>(true);
  const [modoEdicion, setModoEdicion] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'etiquetas'),
      snap => {
        const data = snap.data() || {};
        const limpio: Record<string, string> = {};
        Object.keys(data).forEach(k => {
          const v = data[k];
          if (typeof v === 'string' && v.trim() !== '') limpio[decodificar(k)] = v;
        });
        setEtiquetas(limpio);
        setCargando(false);
      },
      err => {
        console.error("🔥 Error al leer 'config/etiquetas':", err);
        setCargando(false);
      }
    );
    return () => unsub();
  }, []);

  const t = (clave: string, porDefecto: string): string => {
    const v = etiquetas[clave];
    return v && v.trim() !== '' ? v : porDefecto;
  };

  const guardarEtiqueta = async (clave: string, valor: string) => {
    try {
      await setDoc(doc(db, 'config', 'etiquetas'), { [codificar(clave)]: valor }, { merge: true });
    } catch (e) {
      console.error('Error al guardar la etiqueta:', e);
      alert('No se pudo guardar el nombre. Revisa la consola.');
    }
  };

  const guardarVarias = async (cambios: Record<string, string>) => {
    const payload: Record<string, string> = {};
    Object.keys(cambios).forEach(k => { payload[codificar(k)] = cambios[k]; });
    try {
      await setDoc(doc(db, 'config', 'etiquetas'), payload, { merge: true });
    } catch (e) {
      console.error('Error al guardar las etiquetas:', e);
      alert('No se pudieron guardar los nombres. Revisa la consola.');
    }
  };

  // Restablecer = guardar cadena vacía, con lo que vuelve el texto por defecto
  const restablecer = async (clave: string) => {
    await guardarEtiqueta(clave, '');
  };

  return (
    <EtiquetasContext.Provider value={{ etiquetas, cargando, modoEdicion, setModoEdicion, t, guardarEtiqueta, guardarVarias, restablecer }}>
      {children}
    </EtiquetasContext.Provider>
  );
};
