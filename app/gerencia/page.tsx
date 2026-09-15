'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Gerencia() {
  const [user, setUser] = useState<any>(null)
  const [visitas, setVisitas] = useState<any[]>([])
  const [perfiles, setPerfiles] = useState<any[]>([])
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>('todos')
  const [cargando, setCargando] = useState(true)
  
  const [listaMedicos, setListaMedicos] = useState<any[]>([])
  const [listaInstituciones, setListaInstituciones] = useState<any[]>([])

  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ vendedor_id: '', institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
  const router = useRouter()

  const equipos: Record<string, string[]> = {
    mdebernardo: ['amacchi', 'fbustos', 'jpetrone', 'jravazzoli', 'juanpablo', 'mcrespo', 'pedro', 'rmijaloski', 'rpetta', 'mdebernardo'],
    ppasciani: ['julieta', 'maria', 'micaela', 'nbriscioli', 'nicole', 'ppasciani'],
    ignacio: ['angelina', 'ffernandez', 'ignacio']
  }

  const cargarVisitas = async () => {
    const { data } = await supabase.from('visitas').select('*').order('fecha_hora', { ascending: false })
    if (data) setVisitas(data)
  }

  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }

      const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      if (!perfil || (perfil.rol !== 'gerencia' && perfil.rol !== 'super_gerencia')) { router.push('/dashboard'); return }
      setUser(perfil)

      const { data: listaPerfiles } = await supabase.from('perfiles').select('*')
      if (listaPerfiles) setPerfiles(listaPerfiles)

      const { data: medicos } = await supabase.from('medicos').select('nombre').order('nombre')
      const { data: inst } = await supabase.from('instituciones').select('nombre').order('nombre')
      if (medicos) setListaMedicos(medicos)
      if (inst) setListaInstituciones(inst)

      await cargarVisitas()
      setCargando(false)
    }
    initData()
  }, [router])

  const exportarExcel = () => {
    const cabeceras = ['Fecha', 'Vendedor', 'Médico', 'Institución', 'Estado', 'Objetivo Logrado', 'Duración (min)', 'Motivo']
    const filas = visitasFiltradas.map(v => {
      const vendedor = perfiles.find(p => p.id === v.vendedor_id)
      return [new Date(v.fecha_hora).toLocaleDateString('es-AR'), vendedor ? (vendedor.nombre || vendedor.email) : 'Desconocido', v.medico, v.institucion || '', v.estado, v.resultado_logrado ? 'Sí' : (v.resultado_logrado === false ? 'No' : ''), v.resultado_duracion || '', v.resultado_motivo || ''].join(';')
    })
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [cabeceras.join(';'), ...filas].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", `Reporte_Visitas_${new Date().toLocaleDateString('es-AR')}.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.vendedor_id) return alert("Por favor, seleccioná un vendedor.")

    const { error } = await supabase.from('visitas').insert({
      vendedor_id: formData.vendedor_id, institucion: formData.institucion, servicio: formData.servicio,
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(),
      direccion: formData.direccion, notas: formData.notas, estado: 'pendiente'
    })

    if (!error) {
      if (formData.medico && !listaMedicos.some(m => m.nombre.toLowerCase() === formData.medico.toLowerCase())) await supabase.from('medicos').insert({ nombre: formData.medico })
      if (formData.institucion && !listaInstituciones.some(i => i.nombre.toLowerCase() === formData.institucion.toLowerCase())) await supabase.from('instituciones').insert({ nombre: formData.institucion })
      setShowModal(false)
      setFormData({ vendedor_id: '', institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
      cargarVisitas()
    }
  }

  if (cargando) return <div className="p-8 text-center">Cargando...</div>

  let listaVendedoresPermitidos = perfiles
  if (user.rol === 'gerencia') {
    const emailPrefix = user.email.split('@')[0].toLowerCase()
    const misVendedores = equipos[emailPrefix] || []
    listaVendedoresPermitidos = perfiles.filter(p => misVendedores.includes(p.email.split('@')[0].toLowerCase()))
  }

  const visitasFiltradas = vendedorSeleccionado === 'todos' 
    ? visitas.filter(v => listaVendedoresPermitidos.some(p => p.id === v.vendedor_id))
    : visitas.filter(v => v.vendedor_id === vendedorSeleccionado)

  const totalPlanificadas = visitasFiltradas.length
  const totalRealizadas = visitasFiltradas.filter(v => v.estado === 'realizada').length
  const totalLogradas = visitasFiltradas.filter(v => v.resultado_logrado === true).length
  const porcentajeCumplimiento = totalRealizadas > 0 ? Math.round((totalLogradas / totalRealizadas) * 100) : 0
  const duracionPromedio = totalRealizadas > 0 ? Math.round(visitasFiltradas.reduce((acc, v) => acc + (v.resultado_duracion || 0), 0) / totalRealizadas) : 0

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      
      <datalist id="lista-medicos-gerencia">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones-gerencia">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border-l-4 border-indigo-600">
          <div><h1 className="text-xl font-bold text-gray-800">Panel de Gerencia</h1><p className="text-sm text-gray-500">{user.email}</p></div>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-sm text-red-600 font-medium hover:bg-red-50 px-3 py-2 rounded">Cerrar sesión</button>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center w-full md:w-auto">
            <label className="font-medium text-gray-700 text-sm">Filtrar por Vendedor:</label>
            <select value={vendedorSeleccionado} onChange={(e) => setVendedorSeleccionado(e.target.value)} className="border rounded p-2 text-sm w-full md:w-auto">
              {user.rol === 'super_gerencia' && <option value="todos">Todo el equipo completo</option>}
              {user.rol === 'gerencia' && <option value="todos">Solo mi equipo</option>}
              {listaVendedoresPermitidos.map(v => (
                <option key={v.id} value={v.id}>{v.nombre || v.email}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-blue-700 w-full md:w-auto">+ Asignar visita</button>
            <button onClick={exportarExcel} className="bg-green-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-green-700 w-full md:w-auto">Descargar Excel</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center"><p className="text-sm text-gray-500 font-medium mb-1">Total Planificadas</p><p className="text-2xl font-bold text-gray-800">{totalPlanificadas}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center"><p className="text-sm text-gray-500 font-medium mb-1">Total Realizadas</p><p className="text-2xl font-bold text-indigo-600">{totalRealizadas}</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center"><p className="text-sm text-gray-500 font-medium mb-1">% Cumplimiento</p><p className="text-2xl font-bold text-green-600">{porcentajeCumplimiento}%</p></div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center"><p className="text-sm text-gray-500 font-medium mb-1">Duración Promedio</p><p className="text-2xl font-bold text-gray-800">{duracionPromedio} <span className="text-sm font-normal text-gray-500">min</span></p></div>
        </div>

        <div className="grid gap-4">
          <h2 className="text-lg font-bold text-gray-700 mb-2">Historial de visitas</h2>
          {visitasFiltradas.length === 0 ? (<p className="text-center text-gray-500 bg-white p-8 rounded-xl border-2 border-dashed">No hay datos.</p>) : (
            visitasFiltradas.map((visita) => {
              const vendedor = perfiles.find(p => p.id === visita.vendedor_id)
              return (
                <div key={visita.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{visita.medico}</h3>
                    <p className="text-sm text-gray-600">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
                    <p className="text-sm font-medium text-indigo-600 mt-1">Vendedor: {vendedor ? (vendedor.nombre || vendedor.email) : 'Desconocido'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${visita.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : visita.estado === 'realizada' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>{visita.estado.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">{new Date(visita.fecha_hora).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Formulario Completo - Nueva Visita Asignada */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Asignar Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asignar a Vendedor (Obligatorio)</label>
                  <select required value={formData.vendedor_id} onChange={(e) => setFormData({...formData, vendedor_id: e.target.value})} className="w-full border rounded p-2">
                    <option value="" disabled>Seleccione vendedor...</option>
                    {listaVendedoresPermitidos.map(v => <option key={v.id} value={v.id}>{v.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médico (Obligatorio)</label>
                  <input type="text" required list="lista-medicos-gerencia" autoComplete="off" placeholder="Buscar o crear nuevo..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full border rounded p-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Institución</label><input type="text" list="lista-instituciones-gerencia" autoComplete="off" placeholder="Buscar o crear..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full border rounded p-2" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full border rounded p-2" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full border rounded p-2"></textarea></div>
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar y Asignar</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}