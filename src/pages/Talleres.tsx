import React, { useState, useContext, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Store, Plus, Trash2, Image as ImageIcon, Pencil, MapPin, GripVertical, Save, X, Palette } from 'lucide-react';
import type { Taller } from '../types';

// Paleta de colores sugeridos para identificar visualmente cada taller
const COLOR_DEFAULT = '#1d8cf8';
const PALETA_TALLER = [
  '#1d8cf8', '#00d6b4', '#ff8d72', '#d048b6', '#ffbc11', '#51cbce',
  '#8965e0', '#2dce89', '#f56036', '#c72e6b', '#2a86ff', '#e2d849',
  '#e14eca', '#fd5d93', '#00bcd4', '#4caf50', '#ff9800', '#9c27b0',
];

export const Talleres = () => {
  const contexto = useContext(AppContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Nivel de acceso del rol sobre este módulo (Roles y Permisos)
  const { puedeEditar, puedeEliminar } = useAuth();
  const puedoEditar = puedeEditar('talleres');
  const puedoEliminar = puedeEliminar('talleres');
  
  // Estados del Formulario y Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [color, setColor] = useState<string>(COLOR_DEFAULT);

  // Estados para Drag and Drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
    setColor(COLOR_DEFAULT);
    setIsModalOpen(true);
  };

  const prepararEdicion = (taller: Taller) => {
    setEditandoId(taller.id);
    setNombre(taller.nombre);
    setDireccion(taller.direccion || '');
    setLogoBase64(taller.logo);
    setColor((taller as any).color || COLOR_DEFAULT);
    setIsModalOpen(true);
  };

  const cancelarEdicion = () => {
    setIsModalOpen(false);
    setEditandoId(null);
    setNombre('');
    setDireccion('');
    setLogoBase64('');
    setColor(COLOR_DEFAULT);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const guardarTaller = () => {
    if (!nombre.trim()) return alert('Debe ingresar el nombre del taller');
    if (!logoBase64) return alert('Debe cargar un logo');

    const tallerData = {
      id: editandoId || crypto.randomUUID(),
      nombre,
      direccion,
      logo: logoBase64,
      color: color || COLOR_DEFAULT,
      orden: editandoId 
        ? contexto.talleres.find(t => t.id === editandoId)?.orden || 0 
        : contexto.talleres.length
    } as Taller;

    contexto.agregarTaller(tallerData);
    cancelarEdicion();
  };

  // --- LÓGICA DE DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requiere que se establezca información en el dataTransfer para permitir el drag
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault(); // Necesario para permitir que se suelte el elemento
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const nuevosTalleres = [...talleresOrdenados];
    const draggedItem = nuevosTalleres[draggedIndex];

    // Remover de la posición original
    nuevosTalleres.splice(draggedIndex, 1);
    // Insertar en la nueva posición
    nuevosTalleres.splice(dropIndex, 0, draggedItem);

    // Actualizar la propiedad 'orden' de todos los elementos y guardar
    nuevosTalleres.forEach((t, i) => {
      contexto.agregarTaller({ ...t, orden: i });
    });

    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
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
          {puedoEditar && (
            <button className="btn btn-primary" onClick={abrirModalNuevo}>
              <Plus size={18} /> Registrar Taller
            </button>
          )}
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
                    <tr 
                      key={taller.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      style={{ 
                        borderBottom: '1px solid var(--border)', 
                        transition: 'all 0.2s',
                        opacity: draggedIndex === index ? 0.4 : 1,
                      }} 
                      onMouseOver={(e) => { if(draggedIndex !== index) e.currentTarget.style.backgroundColor = 'var(--bg-panel)' }} 
                      onMouseOut={(e) => { if(draggedIndex !== index) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      
                      {/* DRAG HANDLE (con acento de color del taller) */}
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center', borderLeft: `5px solid ${(taller as any).color || COLOR_DEFAULT}` }}>
                        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'grab' }} title="Arrastrar para reordenar">
                          <GripVertical size={20} />
                        </div>
                      </td>

                      {/* LOGO (borde con el color del taller) */}
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--bg-panel)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `2px solid ${(taller as any).color || COLOR_DEFAULT}` }}>
                          {taller.logo ? (
                            <img src={taller.logo} alt={taller.nombre} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} draggable="false" />
                          ) : (
                            <ImageIcon size={20} color="var(--text-muted)" />
                          )}
                        </div>
                      </td>

                      {/* NOMBRE (con punto de color del taller) */}
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '1.05rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span
                            title={`Color: ${(taller as any).color || COLOR_DEFAULT}`}
                            style={{
                              width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                              backgroundColor: (taller as any).color || COLOR_DEFAULT,
                              boxShadow: `0 0 0 3px ${((taller as any).color || COLOR_DEFAULT)}22`,
                              border: '1px solid rgba(255,255,255,0.35)'
                            }}
                          />
                          {taller.nombre}
                        </div>
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
                            marginRight: '0.5rem',
                            opacity: puedoEditar ? 1 : 0.4
                          }}
                          disabled={!puedoEditar}
                          title={puedoEditar ? "Editar" : "Tu rol solo puede consultar"}
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
                            borderRadius: '8px',
                            opacity: puedoEliminar ? 1 : 0.4
                          }}
                          disabled={!puedoEliminar}
                          title={puedoEliminar ? "Eliminar" : "Tu rol no puede eliminar"}
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
          <div className="card animate-in fade-in zoom-in" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-panel)', flexShrink: 0 }}>
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

            <div style={{ padding: '2rem 1.5rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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

              {/* --- NUEVO: COLOR DEL TALLER --- */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
                  <Palette size={16} color="var(--text-muted)" /> Color del Taller
                </label>

                {/* Vista previa: cómo se verá el color identificando al taller */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  backgroundColor: 'var(--bg-body)', border: `1px solid var(--border)`,
                  borderLeft: `6px solid ${color || COLOR_DEFAULT}`, marginBottom: '0.85rem'
                }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: color || COLOR_DEFAULT, flexShrink: 0, border: '1px solid rgba(255,255,255,0.35)' }} />
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nombre.trim() || 'Vista previa del taller'}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {(color || COLOR_DEFAULT).toUpperCase()}
                  </span>
                </div>

                {/* Paleta de accesos rápidos */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  {PALETA_TALLER.map(c => {
                    const seleccionado = (color || '').toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        title={c}
                        style={{
                          width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer',
                          backgroundColor: c, flexShrink: 0, transition: 'transform 0.15s',
                          border: seleccionado ? '3px solid var(--text-main)' : '2px solid rgba(255,255,255,0.25)',
                          boxShadow: seleccionado ? `0 0 0 3px ${c}55` : 'none',
                          transform: seleccionado ? 'scale(1.12)' : 'scale(1)'
                        }}
                      />
                    );
                  })}
                </div>

                {/* Selector libre (cualquier color) + hex manual */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="color"
                    value={color || COLOR_DEFAULT}
                    onChange={(e) => setColor(e.target.value)}
                    title="Elegir un color personalizado"
                    style={{ width: '48px', height: '38px', padding: 0, border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'transparent', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    className="form-control"
                    value={color || ''}
                    onChange={(e) => {
                      let v = e.target.value.trim();
                      if (v && !v.startsWith('#')) v = '#' + v;
                      setColor(v);
                    }}
                    placeholder="#1d8cf8"
                    style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '8px', fontFamily: 'monospace' }}
                  />
                </div>
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

            <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'var(--bg-panel)', flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={cancelarEdicion} style={{ padding: '0.6rem 1.5rem' }}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarTaller} disabled={!puedoEditar} style={{ padding: '0.6rem 1.5rem', boxShadow: '0 4px 6px -1px rgba(29, 140, 248, 0.3)', opacity: puedoEditar ? 1 : 0.5 }}>
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