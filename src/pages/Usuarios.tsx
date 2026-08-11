import { useState, useEffect, useMemo } from 'react';
import { initializeApp, deleteApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as signOutSecundario } from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, configFirebase } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import type { Usuario } from '../types';
import {
  Users, Plus, Trash2, Save, X, Pencil, Lock, Mail, ShieldCheck,
  CheckCircle2, XCircle, AlertCircle
} from 'lucide-react';

// =========================================================================
//  ADMINISTRACIÓN DE USUARIOS
//
//  Para crear una cuenta sin cerrar la sesión del administrador se usa una
//  INSTANCIA SECUNDARIA de Firebase: se crea el usuario en ella, se guarda su
//  perfil en Firestore y luego se cierra esa instancia. La sesión principal
//  del administrador queda intacta.
//
//  Nota: eliminar un usuario aquí borra su PERFIL y le quita el acceso, pero
//  la cuenta de autenticación permanece en Firebase (solo puede borrarse
//  desde la consola de Firebase o con el Admin SDK del servidor).
// =========================================================================

const NOMBRE_APP_SECUNDARIA = 'appCreacionUsuarios';

export const Usuarios = () => {
  const { roles, esAdmin, perfil } = useAuth();
  const { t } = useEtiquetas();

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rolId, setRolId] = useState('');
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // --- Suscripción a los usuarios ---
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'usuarios'),
      snap => setUsuarios(snap.docs.map(d => ({ ...d.data(), id: d.id } as Usuario))),
      err => console.error("🔥 Error al leer 'usuarios':", err)
    );
    return () => unsub();
  }, []);

  const usuariosOrdenados = useMemo(
    () => [...usuarios].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [usuarios]
  );

  const rolesOrdenados = useMemo(
    () => [...roles].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [roles]
  );

  if (!esAdmin) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso restringido</h3>
        <p style={{ color: 'var(--text-muted)' }}>Solo un administrador puede gestionar los usuarios.</p>
      </div>
    );
  }

  const abrirNuevo = () => {
    setEditandoId(null);
    setNombre(''); setEmail(''); setPassword('');
    setRolId(rolesOrdenados[0]?.id || '');
    setActivo(true);
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
    setError('');
    setModalAbierto(true);
  };

  const guardar = async () => {
    setError('');
    if (!nombre.trim()) { setError('Escribe el nombre del usuario.'); return; }
    if (!rolId) { setError('Selecciona un rol.'); return; }

    // --- EDICIÓN: solo se actualiza el perfil en Firestore ---
    if (editandoId) {
      setGuardando(true);
      try {
        await setDoc(doc(db, 'usuarios', editandoId), {
          nombre: nombre.trim(), rolId, activo,
        }, { merge: true });
        setModalAbierto(false);
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
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }

    setGuardando(true);
    let appSecundaria: ReturnType<typeof initializeApp> | null = null;
    try {
      // Reutiliza la instancia si quedó de un intento anterior
      const existente = getApps().find(a => a.name === NOMBRE_APP_SECUNDARIA);
      appSecundaria = existente ? getApp(NOMBRE_APP_SECUNDARIA) : initializeApp(configFirebase, NOMBRE_APP_SECUNDARIA);
      const authSecundario = getAuth(appSecundaria);

      const cred = await createUserWithEmailAndPassword(authSecundario, email.trim(), password);

      await setDoc(doc(db, 'usuarios', cred.user.uid), {
        nombre: nombre.trim(),
        email: email.trim(),
        rolId,
        activo,
        creadoEn: new Date().toISOString(),
      });

      // Se cierra la sesión secundaria: la del administrador no se toca
      await signOutSecundario(authSecundario);
      setModalAbierto(false);
    } catch (e: any) {
      console.error('Error al crear el usuario:', e);
      const codigo = e?.code || '';
      if (codigo === 'auth/email-already-in-use') setError('Ese correo ya está registrado.');
      else if (codigo === 'auth/invalid-email') setError('El correo no tiene un formato válido.');
      else if (codigo === 'auth/weak-password') setError('La contraseña es demasiado débil (mínimo 6 caracteres).');
      else setError('No se pudo crear el usuario. Revisa la consola.');
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
    try {
      await setDoc(doc(db, 'usuarios', u.id), { activo: !(u.activo !== false) }, { merge: true });
    } catch (e) {
      console.error('Error al cambiar el estado del usuario:', e);
    }
  };

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
              Da de alta cuentas y asígnales un rol
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {/* TABLA */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', minWidth: '760px' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Acciones</th>
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
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '0.35rem 0.55rem', color: 'var(--primary)', borderColor: 'transparent' }}
                          onClick={() => abrirEditar(u)}
                          title="Editar usuario"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn btn-outline"
                          style={{
                            padding: '0.35rem 0.55rem',
                            color: esYo ? 'var(--text-muted)' : 'var(--danger)',
                            borderColor: 'transparent',
                            cursor: esYo ? 'not-allowed' : 'pointer',
                            opacity: esYo ? 0.45 : 1
                          }}
                          onClick={() => eliminar(u)}
                          disabled={esYo}
                          title={esYo ? 'No puedes eliminar tu propia cuenta' : 'Quitar acceso'}
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
                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <ShieldCheck size={14} color="var(--primary)" />
                        {nombreRol(u.rolId)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => alternarActivo(u)}
                        disabled={esYo}
                        title={esYo ? 'No puedes desactivar tu propia cuenta' : (estaActivo ? 'Desactivar' : 'Activar')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                          background: 'none', border: `1px solid ${estaActivo ? '#22c55e' : 'var(--danger)'}`,
                          color: estaActivo ? '#22c55e' : 'var(--danger)',
                          borderRadius: '12px', padding: '0.2rem 0.7rem',
                          fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.5px',
                          cursor: esYo ? 'not-allowed' : 'pointer', opacity: esYo ? 0.5 : 1
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
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Contraseña temporal</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px' }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Compártela con la persona; podrá cambiarla desde "¿Olvidaste tu contraseña?" en la pantalla de acceso.
                </small>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Rol</label>
              <select
                className="form-control"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={rolId}
                onChange={e => setRolId(e.target.value)}
              >
                <option value="">Selecciona un rol...</option>
                {rolesOrdenados.map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}{r.esAdmin ? ' (administrador)' : ''}</option>
                ))}
              </select>
              {rolesOrdenados.length === 0 && (
                <small style={{ color: 'var(--danger)', fontSize: '0.72rem' }}>
                  No hay roles creados. Ve a "Roles y Permisos" y crea uno primero.
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
              <button className="btn btn-primary" onClick={guardar} disabled={guardando} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Save size={16} /> {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
