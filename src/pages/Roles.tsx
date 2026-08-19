import { useState, useMemo } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useEtiquetas } from '../context/EtiquetasContext';
import { CATALOGO_NAVEGACION, CATALOGO_ACCIONES, TODAS_LAS_VISTAS } from '../config/navegacion';
import type { Rol } from '../types';
import {
  ShieldCheck, Plus, Trash2, Save, X, Check, Lock, AlertCircle, ShieldAlert, Pencil
} from 'lucide-react';

// =========================================================================
//  ROLES Y PERMISOS
//  Cada rol define a qué vistas tiene acceso, incluidas las vistas de
//  ADMINISTRACIÓN (Usuarios, Roles y Permisos, Personalización). Así se puede
//  delegar la administración en otro rol sin convertirlo en administrador.
//  El rol marcado como administrador sigue viendo todo por defecto.
// =========================================================================

const idDesdeNombre = (nombre: string) =>
  nombre.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `rol-${Date.now()}`;

export const Roles = () => {
  const { roles, esAdmin, puedeVer, puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('roles');
  const puedoEliminar = puedeEliminar('roles');
  const { t } = useEtiquetas();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [permisos, setPermisos] = useState<Record<string, boolean>>({});
  // Nivel por vista: { [vista]: { editar, eliminar } }. Sin entrada = solo ver.
  const [permisosAcciones, setPermisosAcciones] = useState<Record<string, { editar?: boolean; eliminar?: boolean }>>({});
  const [acciones, setAcciones] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState(false);

  const rolesOrdenados = useMemo(
    () => [...roles].sort((a, b) => {
      if (a.esAdmin && !b.esAdmin) return -1;
      if (!a.esAdmin && b.esAdmin) return 1;
      return a.nombre.localeCompare(b.nombre);
    }),
    [roles]
  );

  // Entran los administradores y los roles con permiso sobre esta vista
  if (!puedeVer('roles')) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <Lock size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Acceso restringido</h3>
        <p style={{ color: 'var(--text-muted)' }}>Tu rol no tiene permiso para gestionar los roles y permisos.</p>
      </div>
    );
  }

  const abrirNuevo = () => {
    setEditandoId(null);
    setNombre('');
    setDescripcion('');
    setPermisos({});
    setPermisosAcciones({});
    setAcciones({});
    setModalAbierto(true);
  };

  const abrirEditar = (r: Rol) => {
    // El rol de administrador solo lo puede modificar un administrador real
    if (r.esAdmin && !esAdmin) {
      alert('Solo un administrador puede modificar el rol de Administrador.');
      return;
    }
    setEditandoId(r.id);
    setNombre(r.nombre);
    setDescripcion(r.descripcion || '');
    setPermisos({ ...(r.permisos || {}) });
    // Rol antiguo (creado antes de los niveles): se precarga con editar y
    // eliminar en las vistas que ya podía ver, que era su comportamiento real.
    if (r.permisosAcciones === undefined) {
      const inicial: Record<string, { editar?: boolean; eliminar?: boolean }> = {};
      TODAS_LAS_VISTAS.forEach(v => {
        if (!v.soloLectura && r.permisos?.[v.vista]) inicial[v.vista] = { editar: true, eliminar: true };
      });
      setPermisosAcciones(inicial);
    } else {
      setPermisosAcciones({ ...r.permisosAcciones });
    }
    setAcciones({ ...(r.acciones || {}) });
    setModalAbierto(true);
  };

  // VER: al quitar el acceso a una vista se retiran también editar y eliminar,
  // porque no tiene sentido modificar algo que no se puede abrir.
  const alternarPermiso = (vista: string) => {
    const activando = !permisos[vista];
    setPermisos(p => ({ ...p, [vista]: activando }));
    if (!activando) {
      setPermisosAcciones(p => {
        const next = { ...p };
        delete next[vista];
        return next;
      });
    }
  };

  // EDITAR / ELIMINAR de una vista. Marcar cualquiera de los dos implica
  // otorgar también el acceso de lectura a esa vista.
  const alternarNivel = (vista: string, nivel: 'editar' | 'eliminar') => {
    const actual = !!permisosAcciones[vista]?.[nivel];
    const siguiente = !actual;
    setPermisosAcciones(p => {
      const previo = p[vista] || {};
      const combinado = { ...previo, [nivel]: siguiente };
      const next = { ...p };
      if (!combinado.editar && !combinado.eliminar) delete next[vista];
      else next[vista] = combinado;
      return next;
    });
    if (siguiente) setPermisos(p => ({ ...p, [vista]: true }));
  };

  // Marca o desmarca un grupo completo (ver + editar + eliminar de sus vistas)
  const alternarGrupo = (idGrupo: string) => {
    const grupo = CATALOGO_NAVEGACION.find(g => g.id === idGrupo);
    if (!grupo) return;
    const items = grupo.items;
    if (items.length === 0) return;
    const todasActivas = items.every(i => permisos[i.vista]);
    setPermisos(p => {
      const next = { ...p };
      items.forEach(i => { next[i.vista] = !todasActivas; });
      return next;
    });
    setPermisosAcciones(p => {
      const next = { ...p };
      items.forEach(i => {
        if (todasActivas || i.soloLectura) delete next[i.vista];
        else next[i.vista] = { editar: true, eliminar: true };
      });
      return next;
    });
  };

  const guardar = async () => {
    if (!nombre.trim()) { alert('Escribe un nombre para el rol.'); return; }
    const id = editandoId || idDesdeNombre(nombre);
    if (!editandoId && roles.some(r => r.id === id)) {
      alert('Ya existe un rol con ese nombre. Usa otro.');
      return;
    }
    setGuardando(true);
    try {
      const existente = roles.find(r => r.id === id);
      await setDoc(doc(db, 'roles', id), {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        permisos,
        permisosAcciones,
        acciones,
        esAdmin: existente?.esAdmin ?? false,
        protegido: existente?.protegido ?? false,
        creadoEn: existente?.creadoEn ?? new Date().toISOString(),
      }, { merge: true });
      setModalAbierto(false);
    } catch (e) {
      console.error('Error al guardar el rol:', e);
      alert('No se pudo guardar el rol. Revisa la consola.');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (r: Rol) => {
    if (r.protegido) { alert('Este rol es del sistema y no se puede eliminar.'); return; }
    if (!confirm(`¿Eliminar el rol "${r.nombre}"? Los usuarios que lo tengan asignado quedarán sin acceso hasta que les asignes otro rol.`)) return;
    try {
      await deleteDoc(doc(db, 'roles', r.id));
    } catch (e) {
      console.error('Error al eliminar el rol:', e);
      alert('No se pudo eliminar el rol. Revisa la consola.');
    }
  };

  // Cuenta de vistas habilitadas de un rol
  const contarPermisos = (r: Rol) =>
    Object.keys(r.permisos || {}).filter(v => r.permisos[v]).length;

  // ¿Este rol tiene marcada alguna vista de Administración?
  const tieneSensibles = TODAS_LAS_VISTAS.some(v => v.sensible && permisos[v.vista]);

  // ¿Un rol de la tabla tiene vistas de Administración?
  const rolConAdministracion = (r: Rol) =>
    !r.esAdmin && TODAS_LAS_VISTAS.some(v => v.sensible && r.permisos?.[v.vista]);

  return (
    <div className="animate-in fade-in">
      {/* ENCABEZADO */}
      <div className="page-header">
        <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ShieldCheck size={32} color="var(--primary)" />
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t('vista.roles', 'Roles y Permisos')}</h2>
            <p className="page-subtitle" style={{ marginLeft: 0, marginTop: '0.25rem' }}>
              Define qué puede ver cada tipo de usuario
            </p>
          </div>
        </div>
        {puedoEditar && (
          <button className="btn btn-primary" onClick={abrirNuevo} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Nuevo Rol
          </button>
        )}
      </div>

      {/* LISTA DE ROLES */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Acciones</th>
                <th>Rol</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Vistas con acceso</th>
              </tr>
            </thead>
            <tbody>
              {rolesOrdenados.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Aún no hay roles creados. Empieza con "Nuevo Rol".
                  </td>
                </tr>
              )}
              {rolesOrdenados.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '0.35rem 0.55rem', color: 'var(--primary)', borderColor: 'transparent', opacity: puedoEditar ? 1 : 0.4, cursor: puedoEditar ? 'pointer' : 'not-allowed' }}
                        onClick={() => abrirEditar(r)}
                        disabled={!puedoEditar}
                        title={puedoEditar ? "Editar permisos" : "Tu rol solo puede consultar"}
                      >
                        <ShieldCheck size={15} />
                      </button>
                      <button
                        className="btn btn-outline"
                        style={{
                          padding: '0.35rem 0.55rem',
                          color: r.protegido || !puedoEliminar ? 'var(--text-muted)' : 'var(--danger)',
                          borderColor: 'transparent',
                          cursor: r.protegido || !puedoEliminar ? 'not-allowed' : 'pointer',
                          opacity: r.protegido || !puedoEliminar ? 0.45 : 1
                        }}
                        onClick={() => eliminar(r)}
                        disabled={r.protegido || !puedoEliminar}
                        title={r.protegido ? 'Rol del sistema: no se puede eliminar' : puedoEliminar ? 'Eliminar rol' : 'Tu rol no puede eliminar'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                  <td>
                    <strong style={{ color: 'var(--text-main)' }}>{r.nombre}</strong>
                    {r.esAdmin && (
                      <span style={{
                        marginLeft: '0.5rem', fontSize: '0.6rem', fontWeight: 800,
                        color: '#ffbc11', border: '1px solid #ffbc11', borderRadius: '10px',
                        padding: '2px 7px', letterSpacing: '0.5px'
                      }}>
                        ADMINISTRADOR
                      </span>
                    )}
                    {rolConAdministracion(r) && (
                      <span style={{
                        marginLeft: '0.5rem', fontSize: '0.6rem', fontWeight: 800,
                        color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '10px',
                        padding: '2px 7px', letterSpacing: '0.5px'
                      }}>
                        CON ADMINISTRACIÓN
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.descripcion || '—'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>
                    {r.esAdmin
                      ? <span style={{ color: '#22c55e' }}>Acceso total</span>
                      : <span style={{ color: 'var(--primary)' }}>{contarPermisos(r)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE PERMISOS */}
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
            style={{ width: '100%', maxWidth: '640px', maxHeight: '88vh', overflowY: 'auto', margin: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShieldCheck size={24} color="var(--primary)" />
                <div>
                  <h3 style={{ margin: 0, color: 'var(--text-main)' }}>
                    {editandoId ? 'Editar Rol' : 'Nuevo Rol'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Marca las vistas y el nivel de acceso de cada una
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid-layout" style={{ marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Nombre del rol</label>
                <input
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Supervisor, Capturista, Gerente"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción <small style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</small></label>
                <input
                  className="form-control"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Para qué sirve este rol"
                />
              </div>
            </div>

            {/* MATRIZ DE PERMISOS */}
            <h4 className="detail-section-title" style={{ marginTop: 0, marginBottom: '0.5rem' }}>Accesos</h4>
            <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Marca la casilla para dar acceso a una vista. Sin nada más, el rol solo puede <strong style={{ color: 'var(--text-main)' }}>consultar</strong>.
              Activa <strong style={{ color: 'var(--primary)' }}>Editar</strong> para que pueda crear y modificar, y <strong style={{ color: 'var(--danger)' }}>Eliminar</strong> para que pueda borrar registros.
            </p>

            {CATALOGO_NAVEGACION.map(grupo => {
              const vistas = grupo.items;
              if (vistas.length === 0) return null;
              const grupoSensible = vistas.some(v => v.sensible);
              const todasActivas = vistas.every(v => permisos[v.vista]);
              return (
                <div key={grupo.id} style={{ marginBottom: '1rem', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    onClick={() => alternarGrupo(grupo.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.7rem 1rem', backgroundColor: 'var(--bg-highlight)', cursor: 'pointer'
                    }}
                  >
                    <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                      {grupoSensible && <ShieldAlert size={15} color="#f59e0b" />}
                      {t(grupo.claveEtiqueta, grupo.etiqueta)}
                    </strong>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: todasActivas ? '#22c55e' : 'var(--text-muted)' }}>
                      {todasActivas ? 'Quitar todo' : 'Seleccionar todo'}
                    </span>
                  </div>
                  <div style={{ padding: '0.5rem 0' }}>
                    {vistas.map(v => {
                      const activo = !!permisos[v.vista];
                      const puedeEditarVista = !!permisosAcciones[v.vista]?.editar;
                      const puedeEliminarVista = !!permisosAcciones[v.vista]?.eliminar;
                      return (
                        <div
                          key={v.vista}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            gap: '0.75rem', padding: '0.5rem 1rem', flexWrap: 'wrap'
                          }}
                        >
                          {/* VER: da acceso a la vista */}
                          <div
                            onClick={() => alternarPermiso(v.vista)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', minWidth: 0, flex: 1 }}
                          >
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                              backgroundColor: activo ? 'var(--primary)' : 'transparent',
                              border: `2px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                              color: '#fff'
                            }}>
                              {activo && <Check size={13} />}
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: activo ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: activo ? 600 : 400 }}>
                              {t(v.claveEtiqueta, v.etiqueta)}
                              {v.sensible && (
                                <span style={{
                                  fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.5px',
                                  color: '#f59e0b', border: '1px solid #f59e0b',
                                  borderRadius: '10px', padding: '1px 6px'
                                }}>
                                  ADMINISTRACIÓN
                                </span>
                              )}
                            </span>
                          </div>

                          {/* NIVEL DE ACCESO: consultar, modificar o eliminar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                            {v.soloLectura ? (
                              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                Solo consulta
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => alternarNivel(v.vista, 'editar')}
                                  title={`Permite crear y modificar en "${t(v.claveEtiqueta, v.etiqueta)}"`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                    background: puedeEditarVista ? 'rgba(29,140,248,0.15)' : 'transparent',
                                    border: `1px solid ${puedeEditarVista ? 'var(--primary)' : 'var(--border)'}`,
                                    color: puedeEditarVista ? 'var(--primary)' : 'var(--text-muted)',
                                    borderRadius: '999px', padding: '0.18rem 0.65rem',
                                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.5px',
                                    textTransform: 'uppercase', cursor: 'pointer'
                                  }}
                                >
                                  <Pencil size={11} /> Editar
                                </button>
                                <button
                                  onClick={() => alternarNivel(v.vista, 'eliminar')}
                                  title={`Permite eliminar registros en "${t(v.claveEtiqueta, v.etiqueta)}"`}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                    background: puedeEliminarVista ? 'rgba(255,141,114,0.15)' : 'transparent',
                                    border: `1px solid ${puedeEliminarVista ? 'var(--danger)' : 'var(--border)'}`,
                                    color: puedeEliminarVista ? 'var(--danger)' : 'var(--text-muted)',
                                    borderRadius: '999px', padding: '0.18rem 0.65rem',
                                    fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.5px',
                                    textTransform: 'uppercase', cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={11} /> Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* CAPACIDADES ESPECIALES */}
            <h4 className="detail-section-title" style={{ marginTop: '1.5rem', marginBottom: '0.85rem' }}>Capacidades especiales</h4>
            <div style={{ marginBottom: '1.25rem', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              {CATALOGO_ACCIONES.map((a2, i) => {
                const activo = !!acciones[a2.clave];
                return (
                  <div
                    key={a2.clave}
                    onClick={() => setAcciones(p => ({ ...p, [a2.clave]: !p[a2.clave] }))}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                      padding: '0.75rem 1rem', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border)'
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, marginTop: '2px',
                      backgroundColor: activo ? '#7c3aed' : 'transparent',
                      border: `2px solid ${activo ? '#7c3aed' : 'var(--border)'}`, color: '#fff'
                    }}>
                      {activo && <Check size={13} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: activo ? 700 : 500, color: activo ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        {a2.etiqueta}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{a2.descripcion}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1.25rem',
              backgroundColor: tieneSensibles ? 'rgba(245,158,11,0.12)' : 'var(--bg-highlight)',
              border: `1px solid ${tieneSensibles ? '#f59e0b' : 'var(--border)'}`
            }}>
              {tieneSensibles
                ? <ShieldAlert size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
                : <AlertCircle size={16} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '1px' }} />}
              <span style={{ fontSize: '0.75rem', color: tieneSensibles ? 'var(--text-main)' : 'var(--text-muted)', lineHeight: 1.45 }}>
                {tieneSensibles
                  ? 'Este rol tendrá acceso a vistas de Administración: podrá gestionar cuentas, permisos o los textos del sistema. Otórgalo solo a personas de confianza. Únicamente un administrador puede asignar el rol de administrador a un usuario.'
                  : 'Las vistas de Administración (Usuarios, Roles y Personalización) también se pueden otorgar desde esta lista, para delegar la administración sin dar acceso total.'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setModalAbierto(false)}>
                <X size={16} /> Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardar} disabled={guardando || !puedoEditar} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: puedoEditar ? 1 : 0.5 }}>
                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};