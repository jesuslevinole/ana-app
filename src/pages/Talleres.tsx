import React, { useState, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Store, Plus, Trash2, Image as ImageIcon, Pencil, MapPin, ArrowUp, ArrowDown, Save, X } from 'lucide-react';
import type { Taller } from '../types';

export const Talleres = () => {
  const contexto = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados del Formulario y Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');

  if (!contexto) return null;

  // Ordenar talleres por la propiedad 'orden' (si existe)
  const talleresOrdenados = useMemo(() => {
    return [...contexto.talleres].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }, [contexto.talleres]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoBase64(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const abrirModalNuevo = () => {
    setEditandoId(null);
    setNombre('');
    setDireccion('');
    setLogoBase64('');
    setIsModalOpen(true);
  };

  const prepararEdicion = (taller: Taller) => {
    setEditandoId(taller.id);
    setNombre(taller.nombre);
    setDireccion(taller.direccion || '');
    setLogoBase64(taller.logo);
    setIsModalOpen(true);
  };

  const cancelarEdicion = () => {
    setIsModalOpen(false);
    setEditandoId(null);
    setNombre('');
    setDireccion('');
    setLogoBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const guardarTaller = () => {
    if (!nombre.trim()) return alert('Debe ingresar el nombre del taller');
    if (!logoBase64) return alert('Debe cargar un logo');

    const tallerData: Taller = {
      id: editandoId || crypto.randomUUID(),
      nombre,
      direccion,
      logo: logoBase64,
      orden: editandoId 
        ? contexto.talleres.find(t => t.id === editandoId)?.orden || 0 
        : contexto.talleres.length
    };

    contexto.agregarTaller(tallerData);
    cancelarEdicion();
  };

  const moverOrden = (index: number, direccionMov: 'arriba' | 'abajo') => {
    const nuevosTalleres = [...talleresOrdenados];
    const nuevaPos = direccionMov === 'arriba' ? index - 1 : index + 1;

    if (nuevaPos < 0 || nuevaPos >= nuevosTalleres.length) return;

    // Intercambiar posiciones
    const temp = nuevosTalleres[index];
    nuevosTalleres[index] = nuevosTalleres[nuevaPos];
    nuevosTalleres[nuevaPos] = temp;

    // Actualizar propiedad orden y guardar todos
    nuevosTalleres.forEach((t, i) => {
      contexto.agregarTaller({ ...t, orden: i });
    });
  };

  return (
    <div className="animate-in fade-in" style={{ padding: '2.5rem', flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER Y BOTÓN NUEVO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '0.8rem', backgroundColor: 'rgba(29, 140, 248, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
              <Store size={28} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>Gestión de Talleres</h2>
              <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                Configuración de sucursales y orden de visualización en el sistema.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={abrirModalNuevo}>
            <Plus size={18} /> Registrar Taller
          </button>
        </div>

        {/* TABLA DE TALLERES */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="pro-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: 'var(--bg-panel)', borderBottom: '2px solid var(--border)' }}>
                <tr>
                  <th style={{ padding: '1rem 1.5rem', width: '80px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Orden</th>
                  <th style={{ padding: '1rem 1.5rem', width: '120px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Logo</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Nombre del Taller</th>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Dirección</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {talleresOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No hay talleres registrados. Haga clic en "Registrar Taller" para comenzar.
                    </td>
                  </tr>
                ) : (
                  talleresOrdenados.map((taller, index) => (
                    <tr key={taller.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-panel)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      
                      {/* ORDEN */}
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <button 
                            onClick={() => moverOrden(index, 'arriba')} 
                            disabled={index === 0} 
                            style={{ background: 'transparent', border: 'none', color: index === 0 ? 'var(--border)' : 'var(--text-muted)', cursor: index === 0 ? 'default' : 'pointer', padding: '2px' }}
                            title="Mover arriba"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button 
                            onClick={() => moverOrden(index, 'abajo')} 
                            disabled={index === talleresOrdenados.length - 1} 
                            style={{ background: 'transparent', border: 'none', color: index === talleresOrdenados.length - 1 ? 'var(--border)' : 'var(--text-muted)', cursor: index === talleresOrdenados.length - 1 ? 'default' : 'pointer', padding: '2px' }}
                            title="Mover abajo"
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      </td>

                      {/* LOGO */}
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          {taller.logo ? (
                            <img src={taller.logo} alt={taller.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <ImageIcon size={20} color="var(--text-muted)" />
                          )}
                        </div>
                      </td>

                      {/* NOMBRE */}
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '1.05rem' }}>
                        {taller.nombre}
                      </td>

                      {/* DIRECCIÓN */}
                      <td style={{ padding: '1rem 1.5rem', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <MapPin size={16} color="var(--text-muted)" />
                          {taller.direccion || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No especificada</span>}
                        </div>
                      </td>

                      {/* ACCIONES */}
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={() => prepararEdicion(taller)}
                          style={{ 
                            background: 'rgba(29, 140, 248, 0.1)', 
                            border: 'none', 
                            color: 'var(--primary)', 
                            cursor: 'pointer', 
                            padding: '0.5rem', 
                            borderRadius: '8px', 
                            marginRight: '0.5rem' 
                          }}
                          title="Editar"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            if(window.confirm('¿Está seguro de eliminar este taller?')) {
                              contexto.eliminarTaller(taller.id);
                            }
                          }}
                          style={{ 
                            background: 'rgba(255, 76, 76, 0.1)', 
                            border: 'none', 
                            color: 'var(--danger)', 
                            cursor: 'pointer', 
                            padding: '0.5rem', 
                            borderRadius: '8px' 
                          }}
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DE FORMULARIO MEJORADO */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="card animate-in fade-in zoom-in" style={{ width: '90%', maxWidth: '500px', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-panel)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Store size={22} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {editandoId ? 'Editar Taller' : 'Registrar Nuevo Taller'}
                </h3>
              </div>
              <button onClick={cancelarEdicion} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.4rem', borderRadius: '50%', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-body)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem 1.5rem' }}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                  <Store size={16} color="var(--text-muted)" /> Nombre del Taller <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: Auto Repair Central"
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                  <MapPin size={16} color="var(--text-muted)" /> Dirección Física
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: 123 Main St, Maracaibo"
                  value={direccion} 
                  onChange={(e) => setDireccion(e.target.value)} 
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                  <ImageIcon size={16} color="var(--text-muted)" /> Logo de Marca <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ 
                  border: '2px dashed var(--border)', 
                  borderRadius: '12px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  backgroundColor: 'rgba(0,0,0,0.15)', 
                  minHeight: '160px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }} 
                onClick={() => fileInputRef.current?.click()} 
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'} 
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                  {logoBase64 ? (
                    <img src={logoBase64} alt="Preview" style={{ maxHeight: '140px', maxWidth: '90%', objectFit: 'contain', borderRadius: '8px', padding: '0.5rem' }} />
                  ) : (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ padding: '1rem', backgroundColor: 'var(--bg-panel)', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <ImageIcon size={32} color="var(--text-muted)" />
                      </div>
                      <div>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', display: 'block' }}>Haga clic para subir el logo</span>
                        <span style={{ fontSize: '0.8rem' }}>Formatos: PNG, JPG, SVG</span>
                      </div>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'var(--bg-panel)' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelarEdicion} style={{ padding: '0.6rem 1.5rem' }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarTaller} style={{ padding: '0.6rem 1.5rem', boxShadow: '0 4px 6px -1px rgba(29, 140, 248, 0.3)' }}>
                {editandoId ? <Save size={18} style={{ marginRight: '0.5rem' }} /> : <Plus size={18} style={{ marginRight: '0.5rem' }} />} 
                {editandoId ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};