import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, type User
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Usuario, Rol } from '../types';

// =========================================================================
//  AUTENTICACIÓN, PERFIL Y PERMISOS
//
//  · La sesión la maneja Firebase Auth (correo + contraseña).
//  · El PERFIL del usuario vive en Firestore: usuarios/{uid}
//      { nombre, email, rolId, activo }
//  · El ROL vive en Firestore: roles/{id}
//      { nombre, permisos: { [vista]: true }, esAdmin }
//
//  ARRANQUE: si todavía no existe ningún usuario en la colección, el primero
//  que inicie sesión se registra automáticamente como Administrador. Así se
//  puede entrar por primera vez sin depender de la consola de Firebase.
// =========================================================================

// Rol de administrador que se crea automáticamente la primera vez
const ROL_ADMIN_ID = 'administrador';

export interface AuthContextType {
  usuarioAuth: User | null;
  perfil: Usuario | null;
  rol: Rol | null;
  roles: Rol[];
  cargando: boolean;
  errorAcceso: string;
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
  recuperarPassword: (email: string) => Promise<boolean>;
  // Permisos
  esAdmin: boolean;
  puedeVer: (vista: string) => boolean;
  vistasPermitidas: string[];
}

export const AuthContext = createContext<AuthContextType | null>(null);

// Atajo para consumir el contexto sin repetir useContext en cada página
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
};

// Traduce los códigos de Firebase a mensajes entendibles
const mensajeError = (codigo: string): string => {
  switch (codigo) {
    case 'auth/invalid-email': return 'El correo no tiene un formato válido.';
    case 'auth/user-disabled': return 'Esta cuenta está deshabilitada.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed': return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    default: return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [usuarioAuth, setUsuarioAuth] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorAcceso, setErrorAcceso] = useState<string>('');

  // --- Suscripción a los roles (para el menú y la pantalla de Roles) ---
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'roles'),
      snap => setRoles(snap.docs.map(d => ({ ...d.data(), id: d.id } as Rol))),
      err => console.error("🔥 Error al leer 'roles':", err)
    );
    return () => unsub();
  }, []);

  // --- Garantiza que exista el rol Administrador ---
  const asegurarRolAdmin = async () => {
    const ref = doc(db, 'roles', ROL_ADMIN_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        nombre: 'Administrador',
        descripcion: 'Acceso total al sistema',
        permisos: {},
        esAdmin: true,
        protegido: true,
        creadoEn: new Date().toISOString(),
      });
    }
  };

  // --- Carga (o crea) el perfil del usuario que inició sesión ---
  const cargarPerfil = async (user: User) => {
    const ref = doc(db, 'usuarios', user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const datos = { ...snap.data(), id: user.uid } as Usuario;
      // Se registra el último acceso sin bloquear la carga
      setDoc(ref, { ultimoAcceso: new Date().toISOString() }, { merge: true })
        .catch(e => console.error('No se pudo registrar el último acceso:', e));
      setPerfil(datos);
      return datos;
    }

    // No hay perfil: es el primer ingreso de esta cuenta.
    // El primer usuario del sistema se vuelve Administrador automáticamente.
    await asegurarRolAdmin();
    const nuevo: Usuario = {
      id: user.uid,
      nombre: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
      email: user.email || '',
      rolId: ROL_ADMIN_ID,
      activo: true,
      creadoEn: new Date().toISOString(),
      ultimoAcceso: new Date().toISOString(),
    };
    await setDoc(ref, nuevo);
    setPerfil(nuevo);
    return nuevo;
  };

  // --- Escucha los cambios de sesión ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setUsuarioAuth(user);
      if (!user) {
        setPerfil(null);
        setCargando(false);
        return;
      }
      try {
        const datos = await cargarPerfil(user);
        // Un usuario desactivado no puede entrar
        if (datos && datos.activo === false) {
          setErrorAcceso('Tu cuenta está desactivada. Contacta al administrador.');
          await signOut(auth);
          setPerfil(null);
        }
      } catch (e) {
        console.error('Error al cargar el perfil del usuario:', e);
        setErrorAcceso('No se pudo cargar tu perfil. Inténtalo de nuevo.');
      } finally {
        setCargando(false);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Mantiene el perfil al día si cambia su rol desde otra sesión ---
  useEffect(() => {
    if (!usuarioAuth) return;
    const unsub = onSnapshot(
      doc(db, 'usuarios', usuarioAuth.uid),
      snap => {
        if (snap.exists()) setPerfil({ ...snap.data(), id: snap.id } as Usuario);
      },
      err => console.error('Error al escuchar el perfil:', err)
    );
    return () => unsub();
  }, [usuarioAuth]);

  const iniciarSesion = async (email: string, password: string): Promise<boolean> => {
    setErrorAcceso('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return true;
    } catch (e: any) {
      setErrorAcceso(mensajeError(e?.code || ''));
      return false;
    }
  };

  const cerrarSesion = async () => {
    setErrorAcceso('');
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
    }
  };

  const recuperarPassword = async (email: string): Promise<boolean> => {
    setErrorAcceso('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (e: any) {
      setErrorAcceso(mensajeError(e?.code || ''));
      return false;
    }
  };

  // --- PERMISOS ---
  const rol = perfil ? roles.find(r => r.id === perfil.rolId) || null : null;
  const esAdmin = !!rol?.esAdmin;

  const puedeVer = (vista: string): boolean => {
    if (!perfil) return false;
    if (esAdmin) return true;                 // el administrador ve todo
    return !!rol?.permisos?.[vista];
  };

  const vistasPermitidas = rol
    ? Object.keys(rol.permisos || {}).filter(v => rol.permisos[v])
    : [];

  return (
    <AuthContext.Provider value={{
      usuarioAuth, perfil, rol, roles, cargando, errorAcceso,
      iniciarSesion, cerrarSesion, recuperarPassword,
      esAdmin, puedeVer, vistasPermitidas,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
