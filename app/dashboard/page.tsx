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
  
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'semana' | 'mes'>('lista')
  const [fechaCalendario, setFechaCalendario] = useState(new Date()) 
  const [fechaBase, setFechaBase] = useState(new Date()) 
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date()) 

  const [formData, setFormData] = useState({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
  const [cierreData, setCierreData] = useState({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null as number | null, lng: null as number | null })
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

  const esMismoDia = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  const getLunes = (d: Date) => { const dd = new Date(d); const day = dd.getDay(); const diff = dd.getDate() - day + (day === 0 ? -6 : 1); return new Date(dd.getFullYear(), dd.getMonth(), diff) }

  // LISTA
  const lunesSemanaLista = getLunes(fechaBase)
  const diasSemanaLista = Array.from({ length: 5 }).map((_, i) => { const d = new Date(lunesSemanaLista); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaLista = (dias: number) => { const nuevaFecha = new Date(fechaBase); nuevaFecha.setDate(nuevaFecha.getDate() + dias); setFechaBase(nuevaFecha); setDiaSeleccionado(getLunes(nuevaFecha)) }
  const visitasSemanaLista = visitas.filter(v => { const f = new Date(v.fecha_hora); const finSemana = new Date(lunesSemanaLista); finSemana.setDate(finSemana.getDate() + 5); return f >= lunesSemanaLista && f < finSemana })
  const visitasDiaLista = visitasSemanaLista.filter(v => esMismoDia(new Date(v.fecha_hora), diaSeleccionado))
  const realizadasSemana = visitasSemanaLista.filter(v => v.estado === 'realizada').length

  // MES
  const year = fechaCalendario.getFullYear()
  const month = fechaCalendario.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let firstDay = new Date(year, month, 1).getDay()
  firstDay = firstDay === 0 ? 6 : firstDay - 1
  const diasMes = []
  for (let i = 0; i < firstDay; i++) diasMes.push(null)
  for (let i = 1; i <= daysInMonth; i++) diasMes.push(new Date(year, month, i))
  const cambiarMes = (offset: number) => setFechaCalendario(new Date(year, month + offset, 1))

  // SEMANA
  const lunesSemanaCal = getLunes(fechaCalendario)
  const diasSemanaCal = Array.from({length: 7}).map((_, i) => { const d = new Date(lunesSemanaCal); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaCal = (offset: number) => { const d = new Date(fechaCalendario); d.setDate(d.getDate() + (offset * 7)); setFechaCalendario(d) }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('visitas').insert({ vendedor_id: user.id, institucion: formData.institucion, servicio: formData.servicio, medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(), direccion: formData.direccion, notas: formData.notas, estado: 'pendiente' })
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
      navigator.geolocation.getCurrentPosition((pos) => { setCierreData({...cierreData, lat: pos.coords.latitude, lng: pos.coords.longitude}); alert("📍 Ubicación registrada.") }, (err) => alert("Error GPS: " + err.message))
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

  if (!user) return <div className="p-8 text-center text-[#004848] font-bold tracking-wide">Cargando ecosistema Icom...</div>
  const esGerencia = userRole === 'gerencia' || userRole === 'super_gerencia'

  return (
    <main className="min-h-screen bg-[#f4f7f6] p-4 md:p-8">
      <datalist id="lista-medicos">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>
              Mi Agenda <span className="opacity-60 font-medium">| Cirugía</span>
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">{user.email}</p>
          </div>
          <div className="flex gap-3">
            {esGerencia && (<button onClick={() => router.push('/gerencia')} className="bg-[#004848] text-white text-sm font-bold hover:bg-[#003838] px-5 py-2.5 rounded-xl transition-colors shadow-sm">Panel de Gerencia</button>)}
            <button onClick={handleLogout} className="text-sm bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 px-5 py-2.5 rounded-xl transition-colors shadow-sm">Cerrar sesión</button>
          </div>
        </div>
        
        {/* CONTROLES */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex bg-[#f4f7f6] p-1.5 rounded-xl w-full md:w-auto">
             <button onClick={() => setVistaActiva('lista')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'lista' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Lista</button>
             <button onClick={() => setVistaActiva('semana')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'semana' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
             <button onClick={() => setVistaActiva('mes')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'mes' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
          </div>
          <button onClick={() => { const tzOffset = new Date().getTimezoneOffset() * 60000; setFormData({...formData, fecha: (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16)}); setShowModal(true) }} className="bg-[#88B830] text-[#004848] text-sm font-bold py-2.5 px-6 rounded-xl hover:bg-[#7aa62b] shadow-sm w-full md:w-auto transition-colors">
            + Nueva Visita
          </button>
        </div>

        {/* VISTA: LISTA */}
        {vistaActiva === 'lista' && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-50">
                <button onClick={() => cambiarSemanaLista(-7)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">◀</button>
                <div className="text-center">
                  <span className="font-bold text-[#004848] block" style={{fontFamily: 'var(--font-montserrat)'}}>Semana del {lunesSemanaLista.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                  <span className="text-xs text-gray-500 font-bold">{visitasSemanaLista.length} planificadas • {realizadasSemana} realizadas</span>
                </div>
                <button onClick={() => cambiarSemanaLista(7)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors">▶</button>
              </div>
              <div className="flex divide-x divide-gray-50">
                {diasSemanaLista.map((dia, idx) => {
                  const esSel = esMismoDia(dia, diaSeleccionado)
                  const visitasEsteDia = visitasSemanaLista.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).length
                  return (
                    <button key={idx} onClick={() => setDiaSeleccionado(dia)} className={`flex-1 py-4 flex flex-col items-center transition-colors ${esSel ? 'bg-[#f0f5ec] border-b-[3px] border-[#88B830]' : 'hover:bg-gray-50'}`}>
                      <span className={`text-xs font-bold mb-1 ${esSel ? 'text-[#004848]' : 'text-gray-400'}`}>{dia.toLocaleDateString('es-AR', { weekday: 'short' }).toUpperCase()}</span>
                      <span className={`text-2xl font-bold ${esSel ? 'text-[#004848]' : 'text-gray-600'}`}>{dia.getDate()}</span>
                      {visitasEsteDia > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#88B830] mt-1.5"></span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <h2 className="text-lg font-bold text-[#004848] mb-4" style={{fontFamily: 'var(--font-montserrat)'}}>Visitas del {diaSeleccionado.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })}</h2>
            <div className="grid gap-4">
              {visitasDiaLista.length === 0 ? (<p className="text-center text-gray-400 bg-white p-10 rounded-2xl border border-dashed border-gray-200 font-bold">Día libre de visitas.</p>) : (
                visitasDiaLista.map((visita) => (
                <div key={visita.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-[#88B830] transition-colors">
                <div>
                  <h3 className="font-bold text-[#004848] text-lg">{visita.medico}</h3>
                  <p className="text-sm text-gray-500 font-bold">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
                  <p className="text-xs text-gray-400 mt-1 font-bold">{new Date(visita.fecha_hora).toLocaleTimeString('es-AR', { timeStyle: 'short' })}</p>
                </div>
                <div className="flex items-center gap-3 self-start md:self-auto">
                  <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${visita.estado === 'pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : visita.estado === 'realizada' ? 'bg-[#f0f5ec] text-[#004848] border-[#88B830]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{visita.estado.toUpperCase()}</span>
                  {visita.estado === 'pendiente' && (
                    <div className="flex gap-2">
                      <button onClick={() => eliminarVisita(visita.id)} className="text-xs bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 font-bold transition-colors">Eliminar</button>
                      <button onClick={() => setVisitaACerrar(visita)} className="text-xs bg-[#004848] text-white px-4 py-2 rounded-xl hover:bg-[#003838] font-bold transition-colors">Cerrar</button>
                    </div>
                  )}
                </div>
              </div>
              )))}
            </div>
          </>
        )}

        {/* VISTA: MES */}
        {vistaActiva === 'mes' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => cambiarMes(-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&lt;</button>
              <h2 className="text-xl font-bold text-[#004848] capitalize" style={{fontFamily: 'var(--font-montserrat)'}}>{fechaCalendario.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => cambiarMes(1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d => <div key={d} className="text-center font-bold text-gray-400 text-xs py-2">{d}</div>)}
              {diasMes.map((dia, idx) => (
                <div key={idx} className={`min-h-[120px] p-2 border rounded-xl ${dia ? 'bg-white border-gray-100' : 'bg-gray-50 border-transparent'}`}>
                  {dia && (
                    <>
                      <div className="text-right text-xs font-bold text-gray-400 mb-2 pr-1">{dia.getDate()}</div>
                      <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                        {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                          <div key={v.id} className="text-[10px] font-bold leading-tight p-1.5 rounded-lg border bg-[#004848]/5 border-[#004848]/10 text-[#004848] truncate" title={`${v.medico} - ${v.institucion}`}>
                            <span className="opacity-70 mr-1">{new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>{v.medico}
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
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
             <div className="flex justify-between items-center mb-8 min-w-[700px]">
              <button onClick={() => cambiarSemanaCal(-1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&lt;</button>
              <h2 className="text-xl font-bold text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Semana del {diasSemanaCal[0].toLocaleDateString('es-AR')} al {diasSemanaCal[6].toLocaleDateString('es-AR')}</h2>
              <button onClick={() => cambiarSemanaCal(1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-4 min-w-[700px]">
              {diasSemanaCal.map((dia, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <div className={`text-center pb-3 border-b-2 ${esMismoDia(dia, new Date()) ? 'border-[#88B830]' : 'border-gray-50'}`}>
                    <span className={`block text-xs font-bold mb-1 ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-400'}`}>{['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][idx]}</span>
                    <span className={`text-2xl font-bold ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-600'}`}>{dia.getDate()}</span>
                  </div>
                  <div className="flex flex-col gap-2.5 min-h-[300px]">
                    {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                      <div key={v.id} className="text-xs p-3 rounded-xl border shadow-sm bg-white border-gray-100 text-[#004848] hover:border-[#88B830] transition-colors">
                        <div className="font-bold truncate text-[13px]" title={v.medico}>{v.medico}</div>
                        <div className="truncate opacity-70 font-bold mt-0.5" title={v.institucion}>{v.institucion}</div>
                        <div className="mt-2 font-bold opacity-60 flex justify-between items-center">
                          {new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                          {v.estado === 'pendiente' && (<button onClick={() => setVisitaACerrar(v)} className="underline hover:text-[#88B830]">Cerrar</button>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL NUEVA VISITA */}
        {showModal && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Nueva Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Médico (Obligatorio)</label>
                  <input type="text" required list="lista-medicos" autoComplete="off" placeholder="Buscar o crear nuevo..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Institución</label>
                    <input type="text" list="lista-instituciones" autoComplete="off" placeholder="Buscar o crear..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" />
                  </div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Objetivo</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]"></textarea></div>
                <div className="flex gap-3 justify-end mt-4 pt-5 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="px-6 py-3 text-sm font-bold bg-[#88B830] text-[#004848] rounded-xl hover:bg-[#7aa62b] transition-colors shadow-sm">Guardar Visita</button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* MODAL CIERRE */}
        {visitaACerrar && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Cerrar Visita</h3>
              <p className="text-sm font-bold text-gray-500 mb-6">{visitaACerrar.medico}</p>
              <form onSubmit={procesarCierre} className="flex flex-col gap-5">
                <select value={cierreData.resultado} onChange={(e) => setCierreData({...cierreData, resultado: e.target.value})} className="w-full bg-[#f0f5ec] border-[#88B830] rounded-xl p-4 text-sm font-bold text-[#004848] focus:ring-[#88B830] focus:border-[#88B830]">
                  <option value="realizada">✅ Realizada</option><option value="cancelada">❌ Cancelada</option><option value="reprogramada">📅 Reprogramada</option>
                </select>
                
                {cierreData.resultado === 'realizada' && (
                  <>
                    <select value={cierreData.duracion} onChange={(e) => setCierreData({...cierreData, duracion: Number(e.target.value)})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]">
                      <option value={15}>Duración: 15 min</option><option value={30}>Duración: 30 min</option><option value={45}>Duración: 45 min</option><option value={60}>Duración: 60 min</option>
                    </select>
                    <select value={cierreData.logrado} onChange={(e) => setCierreData({...cierreData, logrado: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]">
                      <option value="si">Objetivo Logrado</option><option value="no">Objetivo No Logrado</option>
                    </select>
                    {cierreData.logrado === 'no' && <input type="text" placeholder="Motivo (Obligatorio)" required value={cierreData.motivo} onChange={(e) => setCierreData({...cierreData, motivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]" />}
                    <textarea placeholder="Takeaways / Próximos pasos" rows={2} value={cierreData.takeaways} onChange={(e) => setCierreData({...cierreData, takeaways: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]"></textarea>
                    <button type="button" onClick={obtenerUbicacion} className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-sm transition-colors ${cierreData.lat ? 'bg-[#f0f5ec] text-[#004848] border border-[#88B830]' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{cierreData.lat ? '✅ Ubicación capturada' : '📍 Registrar mi ubicación GPS'}</button>
                  </>
                )}
                
                {cierreData.resultado === 'cancelada' && <input type="text" placeholder="Motivo (Obligatorio)" required value={cierreData.motivo} onChange={(e) => setCierreData({...cierreData, motivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]" />}
                {cierreData.resultado === 'reprogramada' && <input type="datetime-local" required value={cierreData.nuevaFecha} onChange={(e) => setCierreData({...cierreData, nuevaFecha: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm font-bold text-[#004848]" />}
                
                <div className="flex gap-3 justify-end mt-4 pt-5 border-t border-gray-100"><button type="button" onClick={() => setVisitaACerrar(null)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button><button type="submit" className="px-6 py-3 text-sm font-bold bg-[#004848] text-white rounded-xl hover:bg-[#003838] transition-colors shadow-sm">Confirmar Cierre</button></div>
              </form>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`}} />
    </main>
  )
}