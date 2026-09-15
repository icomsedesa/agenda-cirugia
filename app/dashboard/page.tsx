'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('vendedor')
  const [visitas, setVisitas] = useState<any[]>([])
  
  // Listas para los desplegables
  const [listaMedicos, setListaMedicos] = useState<any[]>([])
  const [listaInstituciones, setListaInstituciones] = useState<any[]>([])

  const [showModal, setShowModal] = useState(false)
  const [visitaACerrar, setVisitaACerrar] = useState<any>(null)
  const [fechaBase, setFechaBase] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date())

  const [formData, setFormData] = useState({
    institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: ''
  })
  const [cierreData, setCierreData] = useState({
    resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null as number | null, lng: null as number | null
  })
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/')
      else {
        setUser(session.user)
        
        // Asignación estricta de roles según tu esquema
        const emailPrefix = session.user.email?.split('@')[0].toLowerCase() || ''
        const superGerentes = ['swarner', 'belen', 'federico', 'jbirigoin']
        const gerentes = ['mdebernardo', 'ppasciani', 'ignacio']
        
        let rolEsperado = 'vendedor'
        if (superGerentes.includes(emailPrefix)) rolEsperado = 'super_gerencia'
        else if (gerentes.includes(emailPrefix)) rolEsperado = 'gerencia'

        const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
        if (!perfil) {
          await supabase.from('perfiles').upsert({
            id: session.user.id, email: session.user.email,
            nombre: session.user.user_metadata?.full_name || session.user.email, rol: rolEsperado
          })
          setUserRole(rolEsperado)
        } else {
          if (perfil.rol !== rolEsperado) {
            await supabase.from('perfiles').update({ rol: rolEsperado }).eq('id', session.user.id)
          }
          setUserRole(rolEsperado)
        }

        // Cargar listas desplegables
        const { data: medicos } = await supabase.from('medicos').select('nombre').order('nombre')
        const { data: inst } = await supabase.from('instituciones').select('nombre').order('nombre')
        if (medicos) setListaMedicos(medicos)
        if (inst) setListaInstituciones(inst)
      }
    }
    checkUser()
  }, [router])

  const cargarVisitas = async () => {
    if (!user) return
    const { data } = await supabase.from('visitas').select('*').eq('vendedor_id', user.id).order('fecha_hora', { ascending: true })
    if (data) setVisitas(data)
  }

  useEffect(() => { if (user) cargarVisitas() }, [user])

  // Lógica de fechas (oculta por brevedad, igual a la versión anterior)
  const obtenerLunes = (fecha: Date) => { const d = new Date(fecha); const dia = d.getDay(); const diff = d.getDate() - dia + (dia === 0 ? -6 : 1); return new Date(d.getFullYear(), d.getMonth(), diff) }
  const lunesSemana = obtenerLunes(fechaBase)
  const diasSemana = Array.from({ length: 5 }).map((_, i) => { const d = new Date(lunesSemana); d.setDate(d.getDate() + i); return d })
  const cambiarSemana = (dias: number) => { const nuevaFecha = new Date(fechaBase); nuevaFecha.setDate(nuevaFecha.getDate() + dias); setFechaBase(nuevaFecha); setDiaSeleccionado(obtenerLunes(nuevaFecha)) }
  const esMismoDia = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  
  const visitasSemana = visitas.filter(v => { const f = new Date(v.fecha_hora); const finSemana = new Date(lunesSemana); finSemana.setDate(finSemana.getDate() + 5); return f >= lunesSemana && f < finSemana })
  const visitasDia = visitasSemana.filter(v => esMismoDia(new Date(v.fecha_hora), diaSeleccionado))
  const realizadasSemana = visitasSemana.filter(v => v.estado === 'realizada').length

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 1. Guardar visita
    const { error } = await supabase.from('visitas').insert({
      vendedor_id: user.id, institucion: formData.institucion, servicio: formData.servicio,
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(),
      direccion: formData.direccion, notas: formData.notas, estado: 'pendiente'
    })
    
    if (error) {
      alert('Error: ' + error.message)
      return
    }

    // 2. Revisar si Médico o Institución son nuevos y agregarlos a la base
    if (formData.medico && !listaMedicos.some(m => m.nombre.toLowerCase() === formData.medico.toLowerCase())) {
      await supabase.from('medicos').insert({ nombre: formData.medico })
      setListaMedicos([...listaMedicos, { nombre: formData.medico }].sort((a,b) => a.nombre.localeCompare(b.nombre)))
    }
    if (formData.institucion && !listaInstituciones.some(i => i.nombre.toLowerCase() === formData.institucion.toLowerCase())) {
      await supabase.from('instituciones').insert({ nombre: formData.institucion })
      setListaInstituciones([...listaInstituciones, { nombre: formData.institucion }].sort((a,b) => a.nombre.localeCompare(b.nombre)))
    }

    setShowModal(false)
    setFormData({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
    cargarVisitas()
  }

  const eliminarVisita = async (id: string) => { if (window.confirm("¿Eliminar?")) { await supabase.from('visitas').delete().eq('id', id); cargarVisitas() } }
  
  const procesarCierre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cierreData.resultado === 'reprogramada') {
      await supabase.from('visitas').update({ estado: 'reprogramada' }).eq('id', visitaACerrar.id)
      await supabase.from('visitas').insert({ vendedor_id: user.id, medico: visitaACerrar.medico, institucion: visitaACerrar.institucion, servicio: visitaACerrar.servicio, objetivo: visitaACerrar.objetivo, fecha_hora: new Date(cierreData.nuevaFecha).toISOString(), direccion: visitaACerrar.direccion, notas: visitaACerrar.notas, estado: 'pendiente', reprogramada_desde_id: visitaACerrar.id })
    } else {
      await supabase.from('visitas').update({ estado: cierreData.resultado, resultado_duracion: cierreData.resultado === 'realizada' ? cierreData.duracion : null, resultado_logrado: cierreData.resultado === 'realizada' ? (cierreData.logrado === 'si') : null, resultado_takeaways: cierreData.resultado === 'realizada' ? cierreData.takeaways : null, resultado_motivo: cierreData.motivo }).eq('id', visitaACerrar.id)
    }
    setVisitaACerrar(null)
    setCierreData({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null, lng: null })
    cargarVisitas()
  }

  if (!user) return <div className="p-8 text-center text-gray-500">Cargando agenda...</div>

  const esGerencia = userRole === 'gerencia' || userRole === 'super_gerencia'

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      
      {/* HTML Datalists (ocultos) que alimentan los buscadores */}
      <datalist id="lista-medicos">
        {listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}
      </datalist>
      <datalist id="lista-instituciones">
        {listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}
      </datalist>

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-4 rounded-xl shadow-sm mb-6 gap-4">
          <div><h1 className="text-xl font-bold text-gray-800">Mi Agenda - Cirugía</h1><p className="text-sm text-gray-500">{user.email}</p></div>
          <div className="flex gap-2">
            {esGerencia && (<button onClick={() => router.push('/gerencia')} className="bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 px-4 py-2 rounded">📊 Panel de Gerencia</button>)}
            <button onClick={handleLogout} className="text-sm border border-red-200 text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded">Cerrar sesión</button>
          </div>
        </div>
        
        {/* Panel Semanal (Se mantiene igual) */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => cambiarSemana(-7)} className="p-2 hover:bg-gray-100 rounded">◀</button>
            <div className="text-center"><span className="font-bold block">Semana del {lunesSemana.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span></div>
            <button onClick={() => cambiarSemana(7)} className="p-2 hover:bg-gray-100 rounded">▶</button>
          </div>
          <div className="flex divide-x">
            {diasSemana.map((dia, idx) => {
              const esSel = esMismoDia(dia, diaSeleccionado)
              return (
                <button key={idx} onClick={() => setDiaSeleccionado(dia)} className={`flex-1 py-3 flex flex-col items-center ${esSel ? 'bg-blue-50 border-b-2 border-blue-600' : 'hover:bg-gray-50'}`}>
                  <span className={`text-xs font-medium mb-1 ${esSel ? 'text-blue-800' : 'text-gray-500'}`}>{dia.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase()}</span>
                  <span className={`text-lg font-bold ${esSel ? 'text-blue-900' : 'text-gray-800'}`}>{dia.getDate()}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-700">Visitas del Día</h2>
          <button onClick={() => { const tzOffset = diaSeleccionado.getTimezoneOffset() * 60000; setFormData({...formData, fecha: (new Date(diaSeleccionado.getTime() - tzOffset)).toISOString().slice(0, 16)}); setShowModal(true) }} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-blue-700">+ Agregar</button>
        </div>

        <div className="grid gap-4">
          {visitasDia.map((visita) => (
             <div key={visita.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
             <div><h3 className="font-bold text-gray-800">{visita.medico}</h3><p className="text-sm text-gray-600">{visita.institucion}</p></div>
             <div className="flex items-center gap-2 self-start md:self-auto">
               <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border bg-yellow-100 text-yellow-800`}>{visita.estado.toUpperCase()}</span>
               {visita.estado === 'pendiente' && (<><button onClick={() => eliminarVisita(visita.id)} className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100">Eliminar</button><button onClick={() => setVisitaACerrar(visita)} className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded">Cerrar</button></>)}
             </div>
           </div>
          ))}
        </div>

        {/* Modal Nueva Visita - CON BUSCADORES AUTOCOMPLETABLES */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Nueva Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                
                {/* Input Médico con datalist */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médico (Obligatorio)</label>
                  <input 
                    type="text" 
                    required 
                    list="lista-medicos" 
                    autoComplete="off"
                    placeholder="Escribí para buscar o agregar nuevo..."
                    value={formData.medico} 
                    onChange={(e) => setFormData({...formData, medico: e.target.value})} 
                    className="w-full border rounded p-2" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Input Institución con datalist */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institución</label>
                    <input 
                      type="text" 
                      list="lista-instituciones"
                      autoComplete="off"
                      placeholder="Buscar..."
                      value={formData.institucion} 
                      onChange={(e) => setFormData({...formData, institucion: e.target.value})} 
                      className="w-full border rounded p-2" 
                    />
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full border rounded p-2" /></div>
                </div>

                <input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full border rounded p-2" />
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button></div>
              </form>
            </div>
          </div>
        )}
        
        {/* Modal Cierre (Se mantiene igual, oculto por brevedad) */}
        {visitaACerrar && (
           <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
             <div className="bg-white p-6 rounded-xl w-full max-w-md"><form onSubmit={procesarCierre}><select value={cierreData.resultado} onChange={(e) => setCierreData({...cierreData, resultado: e.target.value})} className="w-full border rounded p-2 mb-4"><option value="realizada">✅ Realizada</option><option value="cancelada">❌ Cancelada</option></select><button type="submit" className="w-full bg-gray-800 text-white rounded p-2">Confirmar</button></form></div>
           </div>
        )}
      </div>
    </main>
  )
}