import { useState, useEffect, useMemo } from 'react';
import { initializeApp, deleteApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as signOutSecundario } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, auth, configFirebase } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import type { Usuario } from '../types';
import {
  Users, Plus, Trash2, Save, X, Pencil, Lock, Mail, ShieldCheck,
  CheckCircle2, XCircle, AlertCircle, Send, RefreshCw, ShieldAlert, MailCheck
} from 'lucide-react';

// =========================================================================
//  ADMINISTRACIÓN DE USUARIOS
//
//  Para crear una cuenta sin cerrar la sesión del administrador se usa una
//  INSTANCIA SECUNDARIA de Firebase: se crea el usuario en ella, se guarda su
//  perfil en Firestore y luego se cierra esa instancia. La sesión principal
//  del administrador queda intacta.
//
//  CORREO DE ACCESO: desde la tabla se puede enviar al usuario un correo con
//  un enlace seguro para que él mismo defina su contraseña y pueda entrar al
//  sistema. El administrador nunca necesita conocer esa contraseña.
//
//  ROL OBLIGATORIO: no se puede crear ni actualizar un usuario sin rol. Los
//  usuarios antiguos que se hayan quedado sin rol se marcan en la tabla para
//  poder corregirlos.
//
//  Nota: eliminar un usuario aquí borra su PERFIL y le quita el acceso, pero
//  la cuenta de autenticación permanece en Firebase (solo puede borrarse
//  desde la consola de Firebase o con el Admin SDK del servidor).
// =========================================================================

const NOMBRE_APP_SECUNDARIA = 'appCreacionUsuarios';

// --- Contraseña temporal segura (el usuario la cambiará con el correo) ---
const aleatorio = (max: number) => {
  try {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
};

const generarPassword = (): string => {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const numeros = '23456789';
  const simbolos = '!@#$%&*';
  const todos = mayusculas + minusculas + numeros + simbolos;
  const tomar = (origen: string) => origen[aleatorio(origen.length)];

  const caracteres = [tomar(mayusculas), tomar(minusculas), tomar(numeros), tomar(simbolos)];
  for (let i = 0; i < 8; i++) caracteres.push(tomar(todos));

  // Mezcla para que las primeras posiciones no sigan siempre el mismo patrón
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
};

// Lee el codigo de error de Firebase sin recurrir a "any"
const codigoError = (e: unknown): string => {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    return String((e as { code?: unknown }).code ?? '');
  }
  return '';
};

const formatearFecha = (iso?: string): string => {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

type Aviso = { tipo: 'ok' | 'error'; texto: string };

export const Usuarios = () => {
  const { roles, esAdmin, perfil, puedeVer, puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('usuarios');
  const puedoEliminar = puedeEliminar('usuarios');
  const { t } = useEtiquetas();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [activo, setActivo] = useState(true);
  const [enviarInvitacion, setEnviarInvitacion] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Correo de acceso: id del usuario al que se le está enviando y aviso global
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // --- Suscripción a los usuarios ---
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'usuarios'),
      snap => setUsuarios(snap.docs.map(d => ({ ...d.data(), id: d.id } as Usuario))),
      err => console.error("🔥 Error al leer 'usuarios':", err)
    );
    return () => unsub();
  }, []);

  // El aviso desaparece solo después de unos segundos
  useEffect(() => {
    if (!aviso) return;
    const temporizador = setTimeout(() => setAviso(null), 7000);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [usuarios]
  );

  const rolesOrdenados = useMemo(
    () => [...roles].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [roles]
  );

  // Usuarios que quedaron sin rol válido (el rol es obligatorio)
  const sinRol = useMemo(
    () => usuarios.filter(u => !u.rolId || !roles.some(r => r.id === u.rolId)),
    [usuarios, roles]
  );

  if (!puedeVer('usuarios')) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso restringido</h3>
        <p style={{ color: 'var(--text-muted)' }}>Tu rol no tiene permiso para gestionar los usuarios.</p>
      </div>
    );
  }

  const abrirNuevo = () => {
    setEditandoId(null);
    setNombre(''); setEmail(''); setPassword('');
    setRolId(rolesOrdenados[0]?.id || '');
    setActivo(true);
    setEnviarInvitacion(true);
    setError('');
    setModalAbierto(true);
  };

  const abrirEditar = (u: Usuario) => {
    setEditandoId(u.id);
    setNombre(u.nombre || '');
    setEmail(u.email || '');
    setPassword('');
    setRolId(u.rolId || '');
    setActivo(u.activo !== false);
    setEnviarInvitacion(false);
    setError('');
    setModalAbierto(true);
  };

  // =====================================================================
  //  CORREO DE ACCESO
  //  Envía un enlace seguro de Firebase para que el usuario defina su
  //  propia contraseña. Sirve tanto para el primer acceso como para
  //  restablecer una contraseña olvidada.
  // =====================================================================
  const enviarCorreoAcceso = async (u: Usuario) => {
    if (!u.email) {
      setAviso({ tipo: 'error', texto: `${u.nombre || 'El usuario'} no tiene un correo registrado.` });
      return;
    }
    if (!confirm(`¿Enviar el correo de acceso a ${u.email}?\n\nRecibirá un enlace para crear su contraseña y poder entrar al sistema.`)) return;

    setEnviandoId(u.id);
    setAviso(null);
    try {
      await sendPasswordResetEmail(auth, u.email);
      // Se deja constancia de la fecha de envío en el perfil
      await setDoc(doc(db, 'usuarios', u.id), { accesoEnviadoEn: new Date().toISOString() }, { merge: true });
      setAviso({
        tipo: 'ok',
        texto: `Correo enviado a ${u.email}. Pídele que revise su bandeja de entrada (y la carpeta de spam) para crear su contraseña.`,
      });
    } catch (e) {
      console.error('Error al enviar el correo de acceso:', e);
      const codigo = codigoError(e);
      if (codigo === 'auth/user-not-found') {
        setAviso({ tipo: 'error', texto: 'Ese correo no tiene una cuenta de acceso en Firebase. Vuelve a crear el usuario.' });
      } else if (codigo === 'auth/invalid-email') {
        setAviso({ tipo: 'error', texto: 'El correo del usuario no tiene un formato válido.' });
      } else if (codigo === 'auth/too-many-requests') {
        setAviso({ tipo: 'error', texto: 'Se enviaron demasiados correos seguidos. Espera unos minutos e inténtalo de nuevo.' });
      } else {
        setAviso({ tipo: 'error', texto: 'No se pudo enviar el correo. Revisa la consola.' });
      }
    } finally {
      setEnviandoId(null);
    }
  };

  const guardar = async () => {
    setError('');
    if (!nombre.trim()) { setError('Escribe el nombre del usuario.'); return; }
    // ROL OBLIGATORIO: ningún usuario puede quedarse sin rol
    if (!rolId) { setError('El rol es obligatorio: selecciona uno para este usuario.'); return; }
    if (!roles.some(r => r.id === rolId)) { setError('El rol seleccionado ya no existe. Elige otro.'); return; }
    if (!esAdmin && roles.find(r => r.id === rolId)?.esAdmin) {
      setError('Solo un administrador puede asignar el rol de Administrador.');
      return;
    }

    // --- EDICIÓN: solo se actualiza el perfil en Firestore ---
    if (editandoId) {
      setGuardando(true);
      try {
        await setDoc(doc(db, 'usuarios', editandoId), {
          nombre: nombre.trim(), rolId, activo,
        }, { merge: true });
        setModalAbierto(false);
        setAviso({ tipo: 'ok', texto: `Usuario "${nombre.trim()}" actualizado.` });
      } catch (e) {
        console.error('Error al actualizar el usuario:', e);
        setError('No se pudo actualizar el usuario.');
      } finally {
        setGuardando(false);
      }
      return;
    }

    // --- ALTA: se crea la cuenta en una instancia secundaria ---
    if (!email.trim()) { setError('Escribe el correo del usuario.'); return; }

    // Si se enviará el correo de acceso, la contraseña puede quedar vacía:
    // se genera una temporal que el usuario reemplazará desde el enlace.
    const passwordFinal = password.trim() || (enviarInvitacion ? generarPassword() : '');
    if (passwordFinal.length < 6) {
      setError(enviarInvitacion
        ? 'La contraseña debe tener al menos 6 caracteres (o déjala vacía para generarla automáticamente).'
        : 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setGuardando(true);
    let appSecundaria: ReturnType<typeof initializeApp> | null = null;
    let creado = false;
    try {
      // Reutiliza la instancia si quedó de un intento anterior
      const existente = getApps().find(a => a.name === NOMBRE_APP_SECUNDARIA);
      appSecundaria = existente ? getApp(NOMBRE_APP_SECUNDARIA) : initializeApp(configFirebase, NOMBRE_APP_SECUNDARIA);
      const authSecundario = getAuth(appSecundaria);

      const cred = await createUserWithEmailAndPassword(authSecundario, email.trim(), passwordFinal);

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre: nombre.trim(),
        email: email.trim(),
        rolId,
        activo,
        creadoEn: new Date().toISOString(),
        ...(enviarInvitacion ? { accesoEnviadoEn: new Date().toISOString() } : {}),
      });
      creado = true;

      // Se cierra la sesión secundaria: la del administrador no se toca
      await signOutSecundario(authSecundario);

      // Correo para que la persona defina su propia contraseña
      if (enviarInvitacion) {
        try {
          await sendPasswordResetEmail(auth, email.trim());
          setAviso({
            tipo: 'ok',
            texto: `Usuario creado y correo de acceso enviado a ${email.trim()}. Podrá crear su contraseña desde ese enlace.`,
          });
        } catch (e) {
          console.error('El usuario se creó, pero falló el envío del correo:', e);
          setAviso({
            tipo: 'error',
            texto: 'El usuario se creó, pero no se pudo enviar el correo. Usa el botón "Enviar correo de acceso" de la tabla.',
          });
        }
      } else {
        setAviso({ tipo: 'ok', texto: `Usuario "${nombre.trim()}" creado. Comparte con él la contraseña temporal.` });
      }

      setModalAbierto(false);
    } catch (e) {
      console.error('Error al crear el usuario:', e);
      if (creado) {
        setError('El usuario se creó, pero ocurrió un problema al finalizar. Revisa la tabla.');
      } else {
        const codigo = codigoError(e);
        if (codigo === 'auth/email-already-in-use') setError('Ese correo ya está registrado.');
        else if (codigo === 'auth/invalid-email') setError('El correo no tiene un formato válido.');
        else if (codigo === 'auth/weak-password') setError('La contraseña es demasiado débil (mínimo 6 caracteres).');
        else setError('No se pudo crear el usuario. Revisa la consola.');
      }
    } finally {
      if (appSecundaria) {
        try { await deleteApp(appSecundaria); } catch { /* ya estaba cerrada */ }
      }
      setGuardando(false);
    }
  };

  const eliminar = async (u: Usuario) => {
    if (u.id === perfil?.id) { alert('No puedes eliminar tu propia cuenta.'); return; }
    if (!confirm(`¿Quitar el acceso de "${u.nombre}"?\n\nSe borrará su perfil y no podrá entrar al sistema. La cuenta de correo seguirá existiendo en Firebase.`)) return;
    try {
      await deleteDoc(doc(db, 'usuarios', u.id));
    } catch (e) {
      console.error('Error al eliminar el usuario:', e);
      alert('No se pudo eliminar el usuario. Revisa la consola.');
    }
  };

  const alternarActivo = async (u: Usuario) => {
    if (u.id === perfil?.id) { alert('No puedes desactivar tu propia cuenta.'); return; }
    // Sin rol no se puede activar: el rol es obligatorio para entrar
    if (!(u.activo !== false) && !roles.some(r => r.id === u.rolId)) {
      setAviso({ tipo: 'error', texto: `Asígnale primero un rol a "${u.nombre}" para poder activarlo.` });
      return;
    }
    try {
      await setDoc(doc(db, 'usuarios', u.id), { activo: !(u.activo !== false) }, { merge: true });
    } catch (e) {
      console.error('Error al cambiar el estado del usuario:', e);
    }
  };

  const rolValido = (id: string) => roles.some(r => r.id === id);
  const nombreRol = (id: string) => roles.find(r => r.id === id)?.nombre || 'Sin rol';

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Users size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('vista.usuarios', 'Usuarios')}</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Da de alta cuentas, asígnales un rol y envíales su correo de acceso
            </p>
          </div>
        </div>
        {puedoEditar && (
          <button className="btn btn-primary" onClick={abrirNuevo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Nuevo Usuario
          </button>
        )}
      </div>

      {/* AVISO (envío de correo, guardado, errores) */}
      {aviso && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
            padding: '0.85rem 1rem', borderRadius: '8px', marginTop: '1.25rem',
            backgroundColor: aviso.tipo === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: `1px solid ${aviso.tipo === 'ok' ? '#22c55e' : 'var(--danger)'}`
          }}
        >
          {aviso.tipo === 'ok'
            ? <MailCheck size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: '1px' }} />
            : <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '1px' }} />}
          <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-main)' }}>{aviso.texto}</span>
          <button
            onClick={() => setAviso(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* USUARIOS SIN ROL: el rol es obligatorio */}
      {sinRol.length > 0 && (
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
            padding: '0.85rem 1rem', borderRadius: '8px', marginTop: '1.25rem',
            backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b'
          }}
        >
          <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>
            {sinRol.length === 1
              ? `El usuario "${sinRol[0].nombre || sinRol[0].email}" no tiene rol asignado y no podrá ver ninguna sección.`
              : `Hay ${sinRol.length} usuarios sin rol asignado: no podrán ver ninguna sección hasta que se los asignes.`}
          </span>
        </div>
      )}

      {/* TABLA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '820px' }}>
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Acciones</th>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuariosOrdenados.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Todavía no hay usuarios registrados.
                  </td>
                </tr>
              )}
              {usuariosOrdenados.map(u => {
                const esYo = u.id === perfil?.id;
                const estaActivo = u.activo !== false;
                const tieneRol = rolValido(u.rolId);
                const enviando = enviandoId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.55rem', color: 'var(--primary)', borderColor: 'transparent', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }}
                          onClick={() => abrirEditar(u)}
                          disabled={!puedoEditar}
                          title={puedoEditar ? "Editar usuario" : "Tu rol solo puede consultar"}
                        >
                          <Pencil size={15} />
                        </button>

                        {/* CORREO DE ACCESO: la persona crea su propia contraseña */}
                        <button
                          className="btn btn-outline"
                          style={{
                            padding: '0.35rem 0.55rem',
                            color: u.email && puedoEditar ? '#22c55e' : 'var(--text-muted)',
                            borderColor: 'transparent',
                            cursor: u.email && !enviando && puedoEditar ? 'pointer' : 'not-allowed',
                            opacity: u.email && puedoEditar ? 1 : 0.45
                          }}
                          onClick={() => enviarCorreoAcceso(u)}
                          disabled={!u.email || enviando || !puedoEditar}
                          title={u.email
                            ? (u.accesoEnviadoEn
                              ? `Reenviar correo de acceso (último envío: ${formatearFecha(u.accesoEnviadoEn)})`
                              : 'Enviar correo de acceso para que cree su contraseña')
                            : 'Este usuario no tiene correo registrado'}
                        >
                          {enviando
                            ? <RefreshCw size={15} className="animate-spin" />
                            : <Send size={15} />}
                        </button>

                        <button
                          className="btn btn-outline"
                          style={{
                            padding: '0.35rem 0.55rem',
                            color: esYo || !puedoEliminar ? 'var(--text-muted)' : 'var(--danger)',
                            borderColor: 'transparent',
                            cursor: esYo || !puedoEliminar ? 'not-allowed' : 'pointer',
                            opacity: esYo || !puedoEliminar ? 0.45 : 1
                          }}
                          onClick={() => eliminar(u)}
                          disabled={esYo || !puedoEliminar}
                          title={esYo ? 'No puedes eliminar tu propia cuenta' : puedoEliminar ? 'Quitar acceso' : 'Tu rol no puede eliminar'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>{u.nombre}</strong>
                      {esYo && (
                        <span style={{
                          marginLeft: '0.5rem', fontSize: '0.6rem', fontWeight: 800,
                          color: 'var(--primary)', border: '1px solid var(--primary)',
                          borderRadius: '10px', padding: '2px 7px'
                        }}>
                          TÚ
                        </span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      <div>{u.email}</div>
                      {u.accesoEnviadoEn && (
                        <small style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: '#22c55e' }}>
                          <MailCheck size={11} /> Acceso enviado el {formatearFecha(u.accesoEnviadoEn)}
                        </small>
                      )}
                    </td>
                    <td>
                      {tieneRol ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          <ShieldCheck size={14} color="var(--primary)" />
                          {nombreRol(u.rolId)}
                        </span>
                      ) : (
                        <button
                          onClick={() => abrirEditar(u)}
                          title="Este usuario no tiene rol: haz clic para asignarle uno"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
                            borderRadius: '12px', padding: '0.2rem 0.7rem',
                            fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.5px', cursor: 'pointer'
                          }}
                        >
                          <ShieldAlert size={12} /> SIN ROL
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => alternarActivo(u)}
                        disabled={esYo || !puedoEditar}
                        title={esYo ? 'No puedes desactivar tu propia cuenta' : puedoEditar ? (estaActivo ? 'Desactivar' : 'Activar') : 'Tu rol solo puede consultar'}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          background: 'none', border: `1px solid ${estaActivo ? '#22c55e' : 'var(--danger)'}`,
                          color: estaActivo ? '#22c55e' : 'var(--danger)',
                          borderRadius: '12px', padding: '0.2rem 0.7rem',
                          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.5px',
                          cursor: esYo || !puedoEditar ? 'not-allowed' : 'pointer', opacity: esYo || !puedoEditar ? 0.5 : 1
                        }}
                      >
                        {estaActivo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {estaActivo ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {modalAbierto && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: '1.5rem'
          }}
          onClick={() => setModalAbierto(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto', margin: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Users size={24} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
                    {editandoId ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {editandoId ? 'Actualiza su nombre, rol o estado' : 'Se creará su cuenta de acceso'}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Nombre completo</label>
              <input
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Jesús Molero"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                Correo electrónico
                {editandoId && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (no se puede cambiar)</small>}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  type="email"
                  className="form-control"
                  style={{
                    width: '100%', boxSizing: 'border-box', paddingLeft: '36px',
                    backgroundColor: editandoId ? 'var(--bg-highlight)' : undefined,
                    cursor: editandoId ? 'not-allowed' : 'text'
                  }}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  readOnly={!!editandoId}
                  placeholder="correo@empresa.com"
                />
              </div>
            </div>

            {!editandoId && (
              <>
                {/* Invitación por correo: la persona define su propia contraseña */}
                <div
                  className="form-group"
                  style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}
                  onClick={() => setEnviarInvitacion(v => !v)}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, width: '20px', height: '20px', borderRadius: '5px', marginTop: '2px',
                    backgroundColor: enviarInvitacion ? 'var(--primary)' : 'transparent',
                    border: `2px solid ${enviarInvitacion ? 'var(--primary)' : 'var(--border)'}`, color: '#fff'
                  }}>
                    {enviarInvitacion && <CheckCircle2 size={13} />}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    Enviar correo de acceso al crearlo
                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                      Recibirá un enlace para crear su propia contraseña y entrar al sistema.
                    </small>
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">
                    Contraseña temporal
                    {enviarInvitacion && <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (opcional)</small>}
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input
                        type="text"
                        className="form-control"
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px' }}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={enviarInvitacion ? 'Se generará automáticamente' : 'Mínimo 6 caracteres'}
                      />
                    </div>
                    <button
                      className="btn btn-outline"
                      onClick={() => setPassword(generarPassword())}
                      title="Generar una contraseña segura"
                      style={{ padding: '0.5rem 0.75rem' }}
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {enviarInvitacion
                      ? 'Con el correo de acceso activado no necesitas compartir ninguna contraseña: la crea el propio usuario.'
                      : 'Compártela con la persona; podrá cambiarla desde "¿Olvidaste tu contraseña?" en la pantalla de acceso.'}
                  </small>
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">
                Rol <span style={{ color: 'var(--danger)' }}>*</span>
                <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (obligatorio)</small>
              </label>
              <select
                className="form-control"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  borderColor: rolId ? undefined : 'var(--danger)'
                }}
                value={rolId}
                onChange={e => setRolId(e.target.value)}
              >
                <option value="">Selecciona un rol...</option>
                {rolesOrdenados.map(r => (
                  <option key={r.id} value={r.id} disabled={r.esAdmin && !esAdmin}>
                    {r.nombre}{r.esAdmin ? (esAdmin ? ' (administrador)' : ' (solo un administrador puede asignarlo)') : ''}
                  </option>
                ))}
              </select>
              {rolesOrdenados.length === 0 ? (
                <small style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>
                  No hay roles creados. Ve a "Roles y Permisos" y crea uno primero.
                </small>
              ) : !rolId && (
                <small style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>
                  Todo usuario debe tener un rol para poder entrar al sistema.
                </small>
              )}
            </div>

            <div
              className="form-group"
              style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
              onClick={() => setActivo(a => !a)}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '20px', height: '20px', borderRadius: '5px',
                backgroundColor: activo ? '#22c55e' : 'transparent',
                border: `2px solid ${activo ? '#22c55e' : 'var(--border)'}`, color: '#fff'
              }}>
                {activo && <CheckCircle2 size={13} />}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                Cuenta activa <small style={{ color: 'var(--text-muted)' }}>(si se desactiva, no podrá entrar)</small>
              </span>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1rem',
                backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid var(--danger)'
              }}>
                <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setModalAbierto(false)}>
                <X size={16} /> Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={guardar}
                disabled={guardando || !rolId || !puedoEditar}
                title={!rolId ? 'Selecciona un rol para poder guardar' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: (guardando || !rolId || !puedoEditar) ? 0.6 : 1, cursor: (guardando || !rolId || !puedoEditar) ? 'not-allowed' : 'pointer' }}
              >
                <Save size={16} /> {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
