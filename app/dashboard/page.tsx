'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [visitas, setVisitas] = useState<any[]>([])
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
        const { data: perfil } = await supabase.from('perfiles').select('id').eq('id', session.user.id).maybeSingle()
        if (!perfil) {
          await supabase.from('perfiles').upsert({
            id: session.user.id, email: session.user.email,
            nombre: session.user.user_metadata?.full_name || session.user.email, rol: 'vendedor'
          })
        }
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

  const obtenerLunes = (fecha: Date) => {
    const d = new Date(fecha)
    const dia = d.getDay()
    const diff = d.getDate() - dia + (dia === 0 ? -6 : 1)
    return new Date(d.getFullYear(), d.getMonth(), diff)
  }

  const lunesSemana = obtenerLunes(fechaBase)
  const diasSemana = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(lunesSemana)
    d.setDate(d.getDate() + i)
    return d
  })

  const cambiarSemana = (dias: number) => {
    const nuevaFecha = new Date(fechaBase)
    nuevaFecha.setDate(nuevaFecha.getDate() + dias)
    setFechaBase(nuevaFecha)
    setDiaSeleccionado(obtenerLunes(nuevaFecha))
  }

  const esMismoDia = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()

  const visitasSemana = visitas.filter(v => {
    const f = new Date(v.fecha_hora)
    const finSemana = new Date(lunesSemana)
    finSemana.setDate(finSemana.getDate() + 5)
    return f >= lunesSemana && f < finSemana
  })
  
  const visitasDia = visitasSemana.filter(v => esMismoDia(new Date(v.fecha_hora), diaSeleccionado))
  const realizadasSemana = visitasSemana.filter(v => v.estado === 'realizada').length

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('visitas').insert({
      vendedor_id: user.id, institucion: formData.institucion, servicio: formData.servicio,
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(),
      direccion: formData.direccion, notas: formData.notas, estado: 'pendiente'
    })
    if (error) alert('Error: ' + error.message)
    else {
      setShowModal(false)
      setFormData({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
      cargarVisitas()
    }
  }

  const eliminarVisita = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar esta visita? Esta acción no se puede deshacer.")) {
      await supabase.from('visitas').delete().eq('id', id)
      cargarVisitas()
    }
  }

  const obtenerUbicacion = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCierreData({...cierreData, lat: pos.coords.latitude, lng: pos.coords.longitude})
          alert("📍 Ubicación registrada con éxito.")
        },
        (err) => alert("Error al obtener ubicación: " + err.message)
      )
    } else {
      alert("Tu navegador no soporta geolocalización.")
    }
  }

  const procesarCierre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cierreData.resultado === 'reprogramada') {
      await supabase.from('visitas').update({ estado: 'reprogramada' }).eq('id', visitaACerrar.id)
      await supabase.from('visitas').insert({
        vendedor_id: user.id, medico: visitaACerrar.medico, institucion: visitaACerrar.institucion,
        servicio: visitaACerrar.servicio, objetivo: visitaACerrar.objetivo,
        fecha_hora: new Date(cierreData.nuevaFecha).toISOString(),
        direccion: visitaACerrar.direccion, notas: visitaACerrar.notas,
        estado: 'pendiente', reprogramada_desde_id: visitaACerrar.id
      })
    } else {
      await supabase.from('visitas').update({
        estado: cierreData.resultado,
        resultado_duracion: cierreData.resultado === 'realizada' ? cierreData.duracion : null,
        resultado_logrado: cierreData.resultado === 'realizada' ? (cierreData.logrado === 'si') : null,
        resultado_takeaways: cierreData.resultado === 'realizada' ? cierreData.takeaways : null,
        resultado_motivo: cierreData.motivo,
        ubicacion_lat: cierreData.lat,
        ubicacion_lng: cierreData.lng
      }).eq('id', visitaACerrar.id)
    }
    setVisitaACerrar(null)
    setCierreData({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null, lng: null })
    cargarVisitas()
  }

  if (!user) return <div className="p-8 text-center text-gray-500">Cargando agenda...</div>

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Mi Agenda - Cirugía</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-red-600 font-medium hover:bg-red-50 px-3 py-2 rounded">Cerrar sesión</button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={() => cambiarSemana(-7)} className="p-2 hover:bg-gray-100 rounded">◀</button>
            <div className="text-center">
              <span className="font-bold block">Semana del {lunesSemana.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              <span className="text-xs text-gray-500">{visitasSemana.length} planificadas • {realizadasSemana} realizadas</span>
            </div>
            <button onClick={() => cambiarSemana(7)} className="p-2 hover:bg-gray-100 rounded">▶</button>
          </div>
          
          <div className="flex divide-x">
            {diasSemana.map((dia, idx) => {
              const esSeleccionado = esMismoDia(dia, diaSeleccionado)
              const visitasEsteDia = visitasSemana.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).length
              return (
                <button key={idx} onClick={() => setDiaSeleccionado(dia)} className={`flex-1 py-3 flex flex-col items-center transition-colors ${esSeleccionado ? 'bg-blue-50 border-b-2 border-blue-600' : 'hover:bg-gray-50'}`}>
                  <span className={`text-xs font-medium mb-1 ${esSeleccionado ? 'text-blue-800' : 'text-gray-500'}`}>{dia.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase()}</span>
                  <span className={`text-lg font-bold ${esSeleccionado ? 'text-blue-900' : 'text-gray-800'}`}>{dia.getDate()}</span>
                  {visitasEsteDia > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-700">Visitas del {diaSeleccionado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}</h2>
          <button onClick={() => {
            const tzOffset = diaSeleccionado.getTimezoneOffset() * 60000
            const localISOTime = (new Date(diaSeleccionado.getTime() - tzOffset)).toISOString().slice(0, 16)
            setFormData({...formData, fecha: localISOTime})
            setShowModal(true)
          }} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-blue-700">+ Agregar visita</button>
        </div>

        <div className="grid gap-4">
          {visitasDia.length === 0 ? (
            <p className="text-center text-gray-500 bg-white p-8 rounded-xl border-2 border-dashed border-gray-200">Día libre de visitas.</p>
          ) : (
            visitasDia.map((visita) => (
              <div key={visita.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                  <h3 className="font-bold text-gray-800">{visita.medico}</h3>
                  <p className="text-sm text-gray-600">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
                  <p className="text-sm text-gray-500">{new Date(visita.fecha_hora).toLocaleTimeString('es-AR', { timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${
                    visita.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                    visita.estado === 'realizada' ? 'bg-green-100 text-green-800 border-green-200' :
                    'bg-gray-100 text-gray-800 border-gray-200'
                  }`}>{visita.estado.toUpperCase()}</span>
                  
                  {visita.estado === 'pendiente' && (
                    <>
                      <button onClick={() => eliminarVisita(visita.id)} className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 font-medium">Eliminar</button>
                      <button onClick={() => setVisitaACerrar(visita)} className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700">Cerrar</button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Nueva Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <input type="text" placeholder="Médico (Obligatorio)" required value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full border rounded p-2" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Institución" value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="border rounded p-2" />
                  <input type="text" placeholder="Servicio" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="border rounded p-2" />
                </div>
                <input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full border rounded p-2" />
                <input type="text" placeholder="Objetivo" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full border rounded p-2" />
                <input type="text" placeholder="Dirección exacta" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full border rounded p-2" />
                <textarea placeholder="Notas internas" rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full border rounded p-2"></textarea>
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {visitaACerrar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Cerrar Visita: {visitaACerrar.medico}</h3>
              <form onSubmit={procesarCierre} className="flex flex-col gap-4">
                <select value={cierreData.resultado} onChange={(e) => setCierreData({...cierreData, resultado: e.target.value})} className="w-full border rounded p-2 font-medium">
                  <option value="realizada">✅ Realizada</option>
                  <option value="cancelada">❌ Cancelada</option>
                  <option value="reprogramada">📅 Reprogramada</option>
                </select>
                
                {cierreData.resultado === 'realizada' && (
                  <>
                    <select value={cierreData.duracion} onChange={(e) => setCierreData({...cierreData, duracion: Number(e.target.value)})} className="w-full border rounded p-2">
                      <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                    </select>
                    <select value={cierreData.logrado} onChange={(e) => setCierreData({...cierreData, logrado: e.target.value})} className="w-full border rounded p-2">
                      <option value="si">Objetivo Logrado</option><option value="no">Objetivo No Logrado</option>
                    </select>
                    {cierreData.logrado === 'no' && <input type="text" placeholder="Motivo (Obligatorio)" required value={cierreData.motivo} onChange={(e) => setCierreData({...cierreData, motivo: e.target.value})} className="w-full border rounded p-2" />}
                    <textarea placeholder="Takeaways / Próximos pasos" rows={2} value={cierreData.takeaways} onChange={(e) => setCierreData({...cierreData, takeaways: e.target.value})} className="w-full border rounded p-2"></textarea>
                    
                    <button type="button" onClick={obtenerUbicacion} className={`w-full py-2 rounded text-sm font-medium ${cierreData.lat ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {cierreData.lat ? '✅ Ubicación capturada' : '📍 Registrar mi ubicación GPS'}
                    </button>
                  </>
                )}
                
                {cierreData.resultado === 'cancelada' && <input type="text" placeholder="Motivo (Obligatorio)" required value={cierreData.motivo} onChange={(e) => setCierreData({...cierreData, motivo: e.target.value})} className="w-full border rounded p-2" />}
                {cierreData.resultado === 'reprogramada' && <input type="datetime-local" required value={cierreData.nuevaFecha} onChange={(e) => setCierreData({...cierreData, nuevaFecha: e.target.value})} className="w-full border rounded p-2" />}
                
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t">
                  <button type="button" onClick={() => setVisitaACerrar(null)} className="px-4 py-2 text-gray-600">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded">Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}