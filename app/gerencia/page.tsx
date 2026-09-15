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
  
  // Estados para el Calendario
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'semana' | 'mes'>('lista')
  const [fechaCalendario, setFechaCalendario] = useState(new Date())
  
  const router = useRouter()

  const equipos: Record<string, string[]> = {
    mdebernardo: ['amacchi', 'fbustos', 'jpetrone', 'jravazzoli', 'juanpablo', 'mcrespo', 'pedro', 'rmijaloski', 'rpetta', 'mdebernardo'],
    ppasciani: ['julieta', 'maria', 'micaela', 'nbriscioli', 'nicole', 'ppasciani'],
    ignacio: ['angelina', 'ffernandez', 'ignacio']
  }

  // Paleta de colores para diferenciar vendedores
  const colores = [
    'bg-blue-100 border-blue-300 text-blue-900', 'bg-red-100 border-red-300 text-red-900',
    'bg-green-100 border-green-300 text-green-900', 'bg-purple-100 border-purple-300 text-purple-900',
    'bg-orange-100 border-orange-300 text-orange-900', 'bg-pink-100 border-pink-300 text-pink-900',
    'bg-teal-100 border-teal-300 text-teal-900', 'bg-yellow-100 border-yellow-400 text-yellow-900'
  ]

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

  const exportarExcel = () => { /* Igual que antes, omitido por brevedad pero sigue funcionando igual en tu código si usás la función del paso anterior. La pego completa para que no falle */
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

  // Lógica de Filtro
  let listaVendedoresPermitidos = perfiles
  if (user.rol === 'gerencia') {
    const emailPrefix = user.email.split('@')[0].toLowerCase()
    const misVendedores = equipos[emailPrefix] || []
    listaVendedoresPermitidos = perfiles.filter(p => misVendedores.includes(p.email.split('@')[0].toLowerCase()))
  }

  const vendedoresOrdenados = [...listaVendedoresPermitidos].sort((a,b) => (a.nombre || a.email).localeCompare(b.nombre || b.email))
  
  const obtenerColorVendedor = (vendedor_id: string) => {
    const index = vendedoresOrdenados.findIndex(v => v.id === vendedor_id)
    return index >= 0 ? colores[index % colores.length] : 'bg-gray-100 border-gray-300 text-gray-800'
  }

  const visitasFiltradas = vendedorSeleccionado === 'todos' 
    ? visitas.filter(v => listaVendedoresPermitidos.some(p => p.id === v.vendedor_id))
    : visitas.filter(v => v.vendedor_id === vendedorSeleccionado)

  // Lógica Calendario Mensual
  const year = fechaCalendario.getFullYear()
  const month = fechaCalendario.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let firstDay = new Date(year, month, 1).getDay()
  firstDay = firstDay === 0 ? 6 : firstDay - 1 // Ajustar para que Lunes sea 0

  const diasMes = []
  for (let i = 0; i < firstDay; i++) diasMes.push(null) // Días vacíos previos
  for (let i = 1; i <= daysInMonth; i++) diasMes.push(new Date(year, month, i))

  // Lógica Calendario Semanal
  const getLunes = (d: Date) => { const dd = new Date(d); const day = dd.getDay(); const diff = dd.getDate() - day + (day === 0 ? -6 : 1); return new Date(dd.getFullYear(), dd.getMonth(), diff) }
  const lunesSemanaCal = getLunes(fechaCalendario)
  const diasSemanaCal = Array.from({length: 7}).map((_, i) => { const d = new Date(lunesSemanaCal); d.setDate(d.getDate() + i); return d })
  
  const esMismoDia = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  const cambiarMes = (offset: number) => setFechaCalendario(new Date(year, month + offset, 1))
  const cambiarSemanaCal = (offset: number) => { const d = new Date(fechaCalendario); d.setDate(d.getDate() + (offset * 7)); setFechaCalendario(d) }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <datalist id="lista-medicos-gerencia">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones-gerencia">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6 border-l-4 border-indigo-600">
          <div><h1 className="text-xl font-bold text-gray-800">Panel de Gerencia</h1><p className="text-sm text-gray-500">{user.email}</p></div>
          <div className="flex gap-2">
            <button onClick={() => router.push('/dashboard')} className="text-sm bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 px-3 py-2 rounded">Ir a mi Agenda</button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-sm text-red-600 font-medium hover:bg-red-50 px-3 py-2 rounded">Cerrar sesión</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4 items-center w-full md:w-auto">
            <label className="font-medium text-gray-700 text-sm">Filtrar:</label>
            <select value={vendedorSeleccionado} onChange={(e) => setVendedorSeleccionado(e.target.value)} className="border rounded p-2 text-sm w-full md:w-auto">
              {user.rol === 'super_gerencia' && <option value="todos">Todo el equipo completo</option>}
              {user.rol === 'gerencia' && <option value="todos">Solo mi equipo</option>}
              {vendedoresOrdenados.map(v => <option key={v.id} value={v.id}>{v.nombre || v.email}</option>)}
            </select>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button onClick={() => setVistaActiva('lista')} className={`px-4 py-1 text-sm font-medium rounded transition-all ${vistaActiva === 'lista' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Lista</button>
             <button onClick={() => setVistaActiva('semana')} className={`px-4 py-1 text-sm font-medium rounded transition-all ${vistaActiva === 'semana' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
             <button onClick={() => setVistaActiva('mes')} className={`px-4 py-1 text-sm font-medium rounded transition-all ${vistaActiva === 'mes' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-blue-700 w-full md:w-auto">+ Asignar visita</button>
            <button onClick={exportarExcel} className="bg-green-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-green-700 w-full md:w-auto">Descargar Excel</button>
          </div>
        </div>

        {/* Leyenda de Colores */}
        {(vistaActiva === 'mes' || vistaActiva === 'semana') && vendedorSeleccionado === 'todos' && (
          <div className="mb-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-gray-500 uppercase mr-2">Referencias:</span>
            {vendedoresOrdenados.map(v => (
              <span key={v.id} className={`text-[11px] font-medium px-2 py-1 rounded border shadow-sm ${obtenerColorVendedor(v.id)}`}>
                {v.nombre || v.email.split('@')[0]}
              </span>
            ))}
          </div>
        )}

        {/* VISTA: LISTA */}
        {vistaActiva === 'lista' && (
          <div className="grid gap-4">
            {visitasFiltradas.map((visita) => {
              const vendedor = perfiles.find(p => p.id === visita.vendedor_id)
              return (
                <div key={visita.id} className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${obtenerColorVendedor(visita.vendedor_id).split(' ')[0].replace('bg-', 'border-')} flex flex-col md:flex-row justify-between md:items-center gap-3`}>
                  <div>
                    <h3 className="font-bold text-gray-800">{visita.medico}</h3>
                    <p className="text-sm text-gray-600">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
                    <p className="text-sm font-medium text-gray-500 mt-1">Vendedor: {vendedor?.nombre || vendedor?.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${visita.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800' : visita.estado === 'realizada' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{visita.estado.toUpperCase()}</span>
                    <span className="text-xs text-gray-400">{new Date(visita.fecha_hora).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VISTA: MES */}
        {vistaActiva === 'mes' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => cambiarMes(-1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">&lt;</button>
              <h2 className="text-lg font-bold text-gray-800 capitalize">{fechaCalendario.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => cambiarMes(1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} className="text-center font-bold text-gray-400 text-sm py-2">{d}</div>)}
              {diasMes.map((dia, idx) => (
                <div key={idx} className={`min-h-[120px] p-1 border rounded-lg ${dia ? 'bg-white' : 'bg-gray-50 border-transparent'}`}>
                  {dia && (
                    <>
                      <div className="text-right text-xs text-gray-400 mb-1 pr-1">{dia.getDate()}</div>
                      <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto custom-scrollbar">
                        {visitasFiltradas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                          <div key={v.id} className={`text-[10px] leading-tight p-1 rounded border ${obtenerColorVendedor(v.vendedor_id)} truncate`} title={`${v.medico} - ${v.institucion}`}>
                            {new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} {v.medico}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA: SEMANA */}
        {vistaActiva === 'semana' && (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
             <div className="flex justify-between items-center mb-6 min-w-[700px]">
              <button onClick={() => cambiarSemanaCal(-1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">&lt;</button>
              <h2 className="text-lg font-bold text-gray-800">Semana del {diasSemanaCal[0].toLocaleDateString('es-AR')} al {diasSemanaCal[6].toLocaleDateString('es-AR')}</h2>
              <button onClick={() => cambiarSemanaCal(1)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-4 min-w-[700px]">
              {diasSemanaCal.map((dia, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className={`text-center pb-2 border-b ${esMismoDia(dia, new Date()) ? 'border-blue-500' : ''}`}>
                    <span className="block text-sm font-bold text-gray-500">{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][idx]}</span>
                    <span className={`text-xl ${esMismoDia(dia, new Date()) ? 'text-blue-600 font-black' : 'text-gray-700'}`}>{dia.getDate()}</span>
                  </div>
                  <div className="flex flex-col gap-2 min-h-[300px]">
                    {visitasFiltradas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                      <div key={v.id} className={`text-xs p-2 rounded-lg border shadow-sm ${obtenerColorVendedor(v.vendedor_id)}`}>
                        <div className="font-bold truncate" title={v.medico}>{v.medico}</div>
                        <div className="truncate opacity-90" title={v.institucion}>{v.institucion}</div>
                        <div className="mt-1 opacity-75 font-medium">{new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Nueva Visita Asignada (Oculto por brevedad, es igual al anterior) */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Asignar Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <select required value={formData.vendedor_id} onChange={(e) => setFormData({...formData, vendedor_id: e.target.value})} className="w-full border rounded p-2">
                  <option value="" disabled>Seleccione vendedor...</option>
                  {vendedoresOrdenados.map(v => <option key={v.id} value={v.id}>{v.email}</option>)}
                </select>
                <input type="text" list="lista-medicos-gerencia" required placeholder="Médico..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="border rounded p-2" />
                <input type="text" list="lista-instituciones-gerencia" placeholder="Institución..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="border rounded p-2" />
                <input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="border rounded p-2" />
                <button type="submit" className="bg-blue-600 text-white rounded p-2 mt-2">Guardar y Asignar</button>
              </form>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}} />
    </main>
  )
}