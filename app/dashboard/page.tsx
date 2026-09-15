'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('vendedor')
  const [visitas, setVisitas] = useState<any[]>([])
  
  const [listaMedicos, setListaMedicos] = useState<any[]>([])
  const [listaInstituciones, setListaInstituciones] = useState<any[]>([])

  const [showModal, setShowModal] = useState(false)
  const [visitaACerrar, setVisitaACerrar] = useState<any>(null)
  
  // Estados para vistas y calendario
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'semana' | 'mes'>('lista')
  const [fechaCalendario, setFechaCalendario] = useState(new Date()) // Usado para Semana y Mes
  const [fechaBase, setFechaBase] = useState(new Date()) // Usado para Lista
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date()) // Usado para Lista

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
        
        const emailPrefix = session.user.email?.split('@')[0].toLowerCase() || ''
        const superGerentes = ['swarner', 'belen', 'federico', 'jbirigoin']
        const gerentes = ['mdebernardo', 'ppasciani', 'ignacio']
        
        let rolEsperado = 'vendedor'
        if (superGerentes.includes(emailPrefix)) rolEsperado = 'super_gerencia'
        else if (gerentes.includes(emailPrefix)) rolEsperado = 'gerencia'

        const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', session.user.id).maybeSingle()
        if (!perfil) {
          await supabase.from('perfiles').upsert({ id: session.user.id, email: session.user.email, nombre: session.user.user_metadata?.full_name || session.user.email, rol: rolEsperado })
          setUserRole(rolEsperado)
        } else {
          if (perfil.rol !== rolEsperado) await supabase.from('perfiles').update({ rol: rolEsperado }).eq('id', session.user.id)
          setUserRole(rolEsperado)
        }

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

  // Helpers Generales
  const esMismoDia = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  const getLunes = (d: Date) => { const dd = new Date(d); const day = dd.getDay(); const diff = dd.getDate() - day + (day === 0 ? -6 : 1); return new Date(dd.getFullYear(), dd.getMonth(), diff) }

  // Lógica Vista LISTA
  const lunesSemanaLista = getLunes(fechaBase)
  const diasSemanaLista = Array.from({ length: 5 }).map((_, i) => { const d = new Date(lunesSemanaLista); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaLista = (dias: number) => { const nuevaFecha = new Date(fechaBase); nuevaFecha.setDate(nuevaFecha.getDate() + dias); setFechaBase(nuevaFecha); setDiaSeleccionado(getLunes(nuevaFecha)) }
  
  const visitasSemanaLista = visitas.filter(v => { const f = new Date(v.fecha_hora); const finSemana = new Date(lunesSemanaLista); finSemana.setDate(finSemana.getDate() + 5); return f >= lunesSemanaLista && f < finSemana })
  const visitasDiaLista = visitasSemanaLista.filter(v => esMismoDia(new Date(v.fecha_hora), diaSeleccionado))
  const realizadasSemana = visitasSemanaLista.filter(v => v.estado === 'realizada').length

  // Lógica Vista MES
  const year = fechaCalendario.getFullYear()
  const month = fechaCalendario.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let firstDay = new Date(year, month, 1).getDay()
  firstDay = firstDay === 0 ? 6 : firstDay - 1

  const diasMes = []
  for (let i = 0; i < firstDay; i++) diasMes.push(null)
  for (let i = 1; i <= daysInMonth; i++) diasMes.push(new Date(year, month, i))
  const cambiarMes = (offset: number) => setFechaCalendario(new Date(year, month + offset, 1))

  // Lógica Vista SEMANA
  const lunesSemanaCal = getLunes(fechaCalendario)
  const diasSemanaCal = Array.from({length: 7}).map((_, i) => { const d = new Date(lunesSemanaCal); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaCal = (offset: number) => { const d = new Date(fechaCalendario); d.setDate(d.getDate() + (offset * 7)); setFechaCalendario(d) }

  // Acciones DB
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('visitas').insert({
      vendedor_id: user.id, institucion: formData.institucion, servicio: formData.servicio,
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(),
      direccion: formData.direccion, notas: formData.notas, estado: 'pendiente'
    })
    if (error) { alert('Error: ' + error.message); return }

    if (formData.medico && !listaMedicos.some(m => m.nombre.toLowerCase() === formData.medico.toLowerCase())) await supabase.from('medicos').insert({ nombre: formData.medico })
    if (formData.institucion && !listaInstituciones.some(i => i.nombre.toLowerCase() === formData.institucion.toLowerCase())) await supabase.from('instituciones').insert({ nombre: formData.institucion })

    setShowModal(false)
    setFormData({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
    cargarVisitas()
  }

  const eliminarVisita = async (id: string) => { if (window.confirm("¿Eliminar?")) { await supabase.from('visitas').delete().eq('id', id); cargarVisitas() } }
  
  const obtenerUbicacion = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setCierreData({...cierreData, lat: pos.coords.latitude, lng: pos.coords.longitude}); alert("📍 Ubicación registrada.") },
        (err) => alert("Error GPS: " + err.message)
      )
    } else { alert("Navegador sin GPS.") }
  }

  const procesarCierre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cierreData.resultado === 'reprogramada') {
      await supabase.from('visitas').update({ estado: 'reprogramada' }).eq('id', visitaACerrar.id)
      await supabase.from('visitas').insert({ vendedor_id: user.id, medico: visitaACerrar.medico, institucion: visitaACerrar.institucion, servicio: visitaACerrar.servicio, objetivo: visitaACerrar.objetivo, fecha_hora: new Date(cierreData.nuevaFecha).toISOString(), direccion: visitaACerrar.direccion, notas: visitaACerrar.notas, estado: 'pendiente', reprogramada_desde_id: visitaACerrar.id })
    } else {
      await supabase.from('visitas').update({ estado: cierreData.resultado, resultado_duracion: cierreData.resultado === 'realizada' ? cierreData.duracion : null, resultado_logrado: cierreData.resultado === 'realizada' ? (cierreData.logrado === 'si') : null, resultado_takeaways: cierreData.resultado === 'realizada' ? cierreData.takeaways : null, resultado_motivo: cierreData.motivo, ubicacion_lat: cierreData.lat, ubicacion_lng: cierreData.lng }).eq('id', visitaACerrar.id)
    }
    setVisitaACerrar(null)
    setCierreData({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null, lng: null })
    cargarVisitas()
  }

  if (!user) return <div className="p-8 text-center text-gray-500">Cargando agenda...</div>
  const esGerencia = userRole === 'gerencia' || userRole === 'super_gerencia'

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      
      <datalist id="lista-medicos">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-4 rounded-xl shadow-sm mb-6 gap-4 border-l-4 border-blue-500">
          <div><h1 className="text-xl font-bold text-gray-800">Mi Agenda - Cirugía</h1><p className="text-sm text-gray-500">{user.email}</p></div>
          <div className="flex gap-2">
            {esGerencia && (<button onClick={() => router.push('/gerencia')} className="bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 px-4 py-2 rounded transition-colors">📊 Panel de Gerencia</button>)}
            <button onClick={handleLogout} className="text-sm border border-red-200 text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded transition-colors">Cerrar sesión</button>
          </div>
        </div>
        
        {/* Controles Principales */}
        <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
             <button onClick={() => setVistaActiva('lista')} className={`px-4 py-1 text-sm font-medium rounded transition-all flex-1 ${vistaActiva === 'lista' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Lista</button>
             <button onClick={() => setVistaActiva('semana')} className={`px-4 py-1 text-sm font-medium rounded transition-all flex-1 ${vistaActiva === 'semana' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
             <button onClick={() => setVistaActiva('mes')} className={`px-4 py-1 text-sm font-medium rounded transition-all flex-1 ${vistaActiva === 'mes' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
          </div>
          <button onClick={() => { const tzOffset = new Date().getTimezoneOffset() * 60000; setFormData({...formData, fecha: (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16)}); setShowModal(true) }} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded hover:bg-blue-700 w-full md:w-auto">
            + Agregar visita
          </button>
        </div>

        {/* VISTA: LISTA (Diaria) */}
        {vistaActiva === 'lista' && (
          <>
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <button onClick={() => cambiarSemanaLista(-7)} className="p-2 hover:bg-gray-100 rounded">◀</button>
                <div className="text-center"><span className="font-bold block">Semana del {lunesSemanaLista.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span><span className="text-xs text-gray-500">{visitasSemanaLista.length} planificadas • {realizadasSemana} realizadas</span></div>
                <button onClick={() => cambiarSemanaLista(7)} className="p-2 hover:bg-gray-100 rounded">▶</button>
              </div>
              <div className="flex divide-x">
                {diasSemanaLista.map((dia, idx) => {
                  const esSel = esMismoDia(dia, diaSeleccionado)
                  const visitasEsteDia = visitasSemanaLista.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).length
                  return (
                    <button key={idx} onClick={() => setDiaSeleccionado(dia)} className={`flex-1 py-3 flex flex-col items-center ${esSel ? 'bg-blue-50 border-b-2 border-blue-600' : 'hover:bg-gray-50'}`}>
                      <span className={`text-xs font-medium mb-1 ${esSel ? 'text-blue-800' : 'text-gray-500'}`}>{dia.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase()}</span>
                      <span className={`text-lg font-bold ${esSel ? 'text-blue-900' : 'text-gray-800'}`}>{dia.getDate()}</span>
                      {visitasEsteDia > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1"></span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-4">Visitas del {diaSeleccionado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}</h2>
            <div className="grid gap-4">
              {visitasDiaLista.length === 0 ? (<p className="text-center text-gray-500 bg-white p-8 rounded-xl border-2 border-dashed border-gray-200">Día libre de visitas.</p>) : (
                visitasDiaLista.map((visita) => (
                <div key={visita.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div><h3 className="font-bold text-gray-800">{visita.medico}</h3><p className="text-sm text-gray-600">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p><p className="text-sm text-gray-500">{new Date(visita.fecha_hora).toLocaleTimeString('es-AR', { timeStyle: 'short' })}</p></div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border ${visita.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : visita.estado === 'realizada' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}`}>{visita.estado.toUpperCase()}</span>
                  {visita.estado === 'pendiente' && (<><button onClick={() => eliminarVisita(visita.id)} className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 font-medium">Eliminar</button><button onClick={() => setVisitaACerrar(visita)} className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700">Cerrar</button></>)}
                </div>
              </div>
              )))}
            </div>
          </>
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
                        {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                          <div key={v.id} className="text-[10px] leading-tight p-1 rounded border bg-blue-50 border-blue-200 text-blue-900 truncate" title={`${v.medico} - ${v.institucion}`}>
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
                    {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                      <div key={v.id} className="text-xs p-2 rounded-lg border shadow-sm bg-blue-50 border-blue-200 text-blue-900">
                        <div className="font-bold truncate" title={v.medico}>{v.medico}</div>
                        <div className="truncate opacity-90" title={v.institucion}>{v.institucion}</div>
                        <div className="mt-1 opacity-75 font-medium flex justify-between">
                          {new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                          {v.estado === 'pendiente' && (<button onClick={() => setVisitaACerrar(v)} className="underline text-blue-700 hover:text-blue-900">Cerrar</button>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formulario Completo - Nueva Visita */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Nueva Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Médico (Obligatorio)</label>
                  <input type="text" required list="lista-medicos" autoComplete="off" placeholder="Buscar o crear nuevo..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full border rounded p-2" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Institución</label>
                    <input type="text" list="lista-instituciones" autoComplete="off" placeholder="Buscar o crear..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full border rounded p-2" />
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full border rounded p-2" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Objetivo de la visita</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Dirección exacta</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full border rounded p-2" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full border rounded p-2"></textarea></div>
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-100"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button></div>
              </form>
            </div>
          </div>
        )}
        
        {/* Formulario Completo - Cierre de Visita */}
        {visitaACerrar && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
              <h3 className="text-lg font-bold mb-4">Cerrar Visita: {visitaACerrar.medico}</h3>
              <form onSubmit={procesarCierre} className="flex flex-col gap-4">
                <select value={cierreData.resultado} onChange={(e) => setCierreData({...cierreData, resultado: e.target.value})} className="w-full border rounded p-2 font-medium">
                  <option value="realizada">✅ Realizada</option><option value="cancelada">❌ Cancelada</option><option value="reprogramada">📅 Reprogramada</option>
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
                    <button type="button" onClick={obtenerUbicacion} className={`w-full py-2 rounded text-sm font-medium ${cierreData.lat ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{cierreData.lat ? '✅ Ubicación capturada' : '📍 Registrar mi ubicación GPS'}</button>
                  </>
                )}
                
                {cierreData.resultado === 'cancelada' && <input type="text" placeholder="Motivo (Obligatorio)" required value={cierreData.motivo} onChange={(e) => setCierreData({...cierreData, motivo: e.target.value})} className="w-full border rounded p-2" />}
                {cierreData.resultado === 'reprogramada' && <input type="datetime-local" required value={cierreData.nuevaFecha} onChange={(e) => setCierreData({...cierreData, nuevaFecha: e.target.value})} className="w-full border rounded p-2" />}
                
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t"><button type="button" onClick={() => setVisitaACerrar(null)} className="px-4 py-2 text-gray-600">Cancelar</button><button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded">Confirmar</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`}} />
    </main>
  )
}