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
  const [visitaDetalle, setVisitaDetalle] = useState<any>(null)
  const [visitaAEditar, setVisitaAEditar] = useState<any>(null)
  const [visitaAAgregarNota, setVisitaAAgregarNota] = useState<any>(null)
  
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'semana' | 'mes'>('lista')
  const [fechaCalendario, setFechaCalendario] = useState(new Date()) 
  const [fechaBase, setFechaBase] = useState(new Date()) 
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date()) 
  const [searchTerm, setSearchTerm] = useState('')

  const [isCargaRapida, setIsCargaRapida] = useState(false)
  const [formData, setFormData] = useState({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
  const [cierreData, setCierreData] = useState({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null as number | null, lng: null as number | null })
  const [notaAdicional, setNotaAdicional] = useState('')
  
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

  // LISTA 6 DIAS
  const lunesSemanaLista = getLunes(fechaBase)
  const diasSemanaLista = Array.from({ length: 6 }).map((_, i) => { const d = new Date(lunesSemanaLista); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaLista = (dias: number) => { const nuevaFecha = new Date(fechaBase); nuevaFecha.setDate(nuevaFecha.getDate() + dias); setFechaBase(nuevaFecha); setDiaSeleccionado(getLunes(nuevaFecha)) }
  const visitasSemanaLista = visitas.filter(v => { const f = new Date(v.fecha_hora); const finSemana = new Date(lunesSemanaLista); finSemana.setDate(finSemana.getDate() + 6); return f >= lunesSemanaLista && f < finSemana })
  const visitasDiaLista = visitasSemanaLista.filter(v => esMismoDia(new Date(v.fecha_hora), diaSeleccionado))
  const realizadasSemana = visitasSemanaLista.filter(v => v.estado === 'realizada').length

  // MES 6 DIAS
  const year = fechaCalendario.getFullYear()
  const month = fechaCalendario.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let firstDay = new Date(year, month, 1).getDay()
  if (firstDay === 0) firstDay = 1
  firstDay = firstDay - 1
  const diasMes = []
  for (let i = 0; i < firstDay; i++) diasMes.push(null)
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i)
    if (d.getDay() !== 0) diasMes.push(d)
  }
  const cambiarMes = (offset: number) => setFechaCalendario(new Date(year, month + offset, 1))

  // SEMANA 6 DIAS
  const lunesSemanaCal = getLunes(fechaCalendario)
  const diasSemanaCal = Array.from({length: 6}).map((_, i) => { const d = new Date(lunesSemanaCal); d.setDate(d.getDate() + i); return d })
  const cambiarSemanaCal = (offset: number) => { const d = new Date(fechaCalendario); d.setDate(d.getDate() + (offset * 7)); setFechaCalendario(d) }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/') }

  // BUSCADOR GLOBAL
  const isSearching = searchTerm.trim().length > 0
  const searchResults = visitas.filter(v => 
    v.medico.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (v.institucion && v.institucion.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => new Date(b.fecha_hora).getTime() - new Date(a.fecha_hora).getTime())

  // NUEVA VISITA (CON CARGA RÁPIDA)
  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    let payload: any = {
      vendedor_id: user.id, institucion: formData.institucion, servicio: formData.servicio, 
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(), 
      direccion: formData.direccion, notas: formData.notas, estado: isCargaRapida ? 'realizada' : 'pendiente'
    }

    if (isCargaRapida) {
      payload = { ...payload, resultado_duracion: cierreData.duracion, resultado_logrado: cierreData.logrado === 'si', resultado_takeaways: cierreData.takeaways }
    }

    const { error } = await supabase.from('visitas').insert(payload)
    if (error) { alert('Error: ' + error.message); return }
    
    if (formData.medico && !listaMedicos.some(m => m.nombre.toLowerCase() === formData.medico.toLowerCase())) await supabase.from('medicos').insert({ nombre: formData.medico })
    if (formData.institucion && !listaInstituciones.some(i => i.nombre.toLowerCase() === formData.institucion.toLowerCase())) await supabase.from('instituciones').insert({ nombre: formData.institucion })
    
    setShowModal(false); setIsCargaRapida(false)
    setFormData({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
    setCierreData({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null, lng: null })
    cargarVisitas()
  }

  // EDITAR VISITA PENDIENTE
  const guardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('visitas').update({
      institucion: formData.institucion, servicio: formData.servicio, medico: formData.medico, 
      objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(), 
      direccion: formData.direccion, notas: formData.notas
    }).eq('id', visitaAEditar.id)
    if (!error) {
      setVisitaAEditar(null); setFormData({ institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
      cargarVisitas()
    }
  }

  // AGREGAR NOTA A VISITA CERRADA
  const guardarNotaAdicional = async (e: React.FormEvent) => {
    e.preventDefault()
    const nuevasNotas = visitaAAgregarNota.notas ? `${visitaAAgregarNota.notas}\n\n[Nota Adicional]: ${notaAdicional}` : `[Nota Adicional]: ${notaAdicional}`
    const { error } = await supabase.from('visitas').update({ notas: nuevasNotas }).eq('id', visitaAAgregarNota.id)
    if (!error) { setVisitaAAgregarNota(null); setNotaAdicional(''); cargarVisitas() }
  }

  const eliminarVisita = async (id: string) => { if (window.confirm("¿Eliminar cita pendiente?")) { await supabase.from('visitas').delete().eq('id', id); cargarVisitas() } }
  
  const obtenerUbicacion = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => { setCierreData({...cierreData, lat: pos.coords.latitude, lng: pos.coords.longitude}); alert("📍 Ubicación registrada.") }, (err) => alert("Error GPS: " + err.message))
    } else { alert("Navegador sin GPS.") }
  }

  // CERRAR VISITA
  const procesarCierre = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cierreData.resultado === 'reprogramada') {
      const notaReprogramacion = `Reprogramada para el ${new Date(cierreData.nuevaFecha).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}`
      await supabase.from('visitas').update({ estado: 'reprogramada', resultado_motivo: notaReprogramacion }).eq('id', visitaACerrar.id)
      await supabase.from('visitas').insert({ vendedor_id: user.id, medico: visitaACerrar.medico, institucion: visitaACerrar.institucion, servicio: visitaACerrar.servicio, objetivo: visitaACerrar.objetivo, fecha_hora: new Date(cierreData.nuevaFecha).toISOString(), direccion: visitaACerrar.direccion, notas: visitaACerrar.notas, estado: 'pendiente', reprogramada_desde_id: visitaACerrar.id })
    } else {
      await supabase.from('visitas').update({ estado: cierreData.resultado, resultado_duracion: cierreData.resultado === 'realizada' ? cierreData.duracion : null, resultado_logrado: cierreData.resultado === 'realizada' ? (cierreData.logrado === 'si') : null, resultado_takeaways: cierreData.resultado === 'realizada' ? cierreData.takeaways : null, resultado_motivo: cierreData.motivo, ubicacion_lat: cierreData.lat, ubicacion_lng: cierreData.lng }).eq('id', visitaACerrar.id)
    }
    setVisitaACerrar(null)
    setCierreData({ resultado: 'realizada', duracion: 15, logrado: 'si', takeaways: '', motivo: '', nuevaFecha: '', lat: null, lng: null })
    cargarVisitas()
  }

  const abrirEdicion = (visita: any) => {
    const tzOffset = new Date(visita.fecha_hora).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(new Date(visita.fecha_hora).getTime() - tzOffset)).toISOString().slice(0, 16);
    setFormData({ institucion: visita.institucion || '', servicio: visita.servicio || '', medico: visita.medico, objetivo: visita.objetivo || '', fecha: localISOTime, direccion: visita.direccion || '', notas: visita.notas || '' })
    setVisitaAEditar(visita)
  }

  if (!user) return <div className="p-8 text-center text-[#004848] font-bold tracking-wide">Cargando ecosistema Icom...</div>
  const esGerencia = userRole === 'gerencia' || userRole === 'super_gerencia'

  return (
    <main className="min-h-screen bg-[#f4f7f6] p-4 md:p-8">
      <datalist id="lista-medicos">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between md:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 gap-4 border-l-4 !border-l-[#88B830]">
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
        
        {/* CONTROLES Y BUSCADOR */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto flex-1">
            <div className="flex bg-[#f4f7f6] p-1.5 rounded-xl w-full md:w-auto">
               <button onClick={() => {setVistaActiva('lista'); setSearchTerm('');}} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'lista' && !isSearching ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Lista</button>
               <button onClick={() => {setVistaActiva('semana'); setSearchTerm('');}} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'semana' && !isSearching ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
               <button onClick={() => {setVistaActiva('mes'); setSearchTerm('');}} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex-1 ${vistaActiva === 'mes' && !isSearching ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
            </div>
            <div className="w-full md:w-64">
              <input type="text" placeholder="🔍 Buscar médico o inst..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#f4f7f6] border-none rounded-xl p-2.5 text-sm font-bold text-[#004848] focus:ring-[#88B830]" />
            </div>
          </div>
          <button onClick={() => { const tzOffset = new Date().getTimezoneOffset() * 60000; setFormData({institucion: '', servicio: '', medico: '', objetivo: '', fecha: (new Date(Date.now() - tzOffset)).toISOString().slice(0, 16), direccion: '', notas: ''}); setShowModal(true) }} className="bg-[#88B830] text-[#004848] text-sm font-bold py-3 px-6 rounded-xl hover:bg-[#7aa62b] shadow-sm w-full md:w-auto transition-colors">
            + Nueva Visita
          </button>
        </div>

        {/* VISTA: RESULTADOS DE BÚSQUEDA */}
        {isSearching ? (
          <div>
            <h2 className="text-lg font-bold text-[#004848] mb-4" style={{fontFamily: 'var(--font-montserrat)'}}>Resultados para "{searchTerm}" ({searchResults.length})</h2>
            <div className="grid gap-4">
              {searchResults.length === 0 ? <p className="text-center text-gray-400 bg-white p-10 rounded-2xl border border-dashed border-gray-200 font-bold">No se encontraron visitas.</p> : searchResults.map(renderTarjetaVisita)}
            </div>
          </div>
        ) : (
          <>
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
                  {visitasDiaLista.length === 0 ? <p className="text-center text-gray-400 bg-white p-10 rounded-2xl border border-dashed border-gray-200 font-bold">Día libre de visitas.</p> : visitasDiaLista.map(renderTarjetaVisita)}
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
                <div className="grid grid-cols-6 gap-2">
                  {['Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <div key={d} className="text-center font-bold text-gray-400 text-xs py-2">{d}</div>)}
                  {diasMes.map((dia, idx) => (
                    <div key={idx} className={`min-h-[120px] p-2 border rounded-xl ${dia ? 'bg-white border-gray-100' : 'bg-gray-50 border-transparent'}`}>
                      {dia && (
                        <>
                          <div className="text-right text-xs font-bold text-gray-400 mb-2 pr-1">{dia.getDate()}</div>
                          <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                            {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                              <div key={v.id} onClick={() => setVisitaDetalle(v)} className="text-[10px] font-bold leading-tight p-1.5 rounded-lg border bg-[#004848]/5 border-[#004848]/10 text-[#004848] truncate cursor-pointer hover:bg-[#004848]/10 transition-colors" title={`${v.medico} - ${v.institucion}`}>
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
                  <h2 className="text-xl font-bold text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Semana del {diasSemanaCal[0].toLocaleDateString('es-AR')} al {diasSemanaCal[5].toLocaleDateString('es-AR')}</h2>
                  <button onClick={() => cambiarSemanaCal(1)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&gt;</button>
                </div>
                <div className="grid grid-cols-6 gap-4 min-w-[700px]">
                  {diasSemanaCal.map((dia, idx) => (
                    <div key={idx} className="flex flex-col gap-3">
                      <div className={`text-center pb-3 border-b-2 ${esMismoDia(dia, new Date()) ? 'border-[#88B830]' : 'border-gray-50'}`}>
                        <span className={`block text-xs font-bold mb-1 ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-400'}`}>{['Lun','Mar','Mié','Jue','Vie','Sáb'][idx]}</span>
                        <span className={`text-2xl font-bold ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-600'}`}>{dia.getDate()}</span>
                      </div>
                      <div className="flex flex-col gap-2.5 min-h-[300px]">
                        {visitas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                          <div key={v.id} onClick={() => setVisitaDetalle(v)} className="text-xs p-3 rounded-xl border shadow-sm bg-white border-gray-100 text-[#004848] hover:border-[#88B830] transition-colors cursor-pointer">
                            <div className="font-bold truncate text-[13px]" title={v.medico}>{v.medico}</div>
                            <div className="truncate opacity-70 font-bold mt-0.5" title={v.institucion}>{v.institucion}</div>
                            <div className="mt-2 font-bold opacity-60 flex justify-between items-center">
                              {new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                              {v.estado === 'pendiente' && (<button onClick={(e) => { e.stopPropagation(); setVisitaACerrar(v); }} className="underline hover:text-[#88B830]">Cerrar</button>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL NUEVA VISITA (CON CARGA RÁPIDA) */}
        {showModal && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-4 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Nueva Visita</h3>
              
              <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3 cursor-pointer" onClick={() => setIsCargaRapida(!isCargaRapida)}>
                <input type="checkbox" checked={isCargaRapida} readOnly className="w-5 h-5 text-[#88B830] rounded focus:ring-[#88B830] cursor-pointer" />
                <div>
                  <p className="text-sm font-bold text-[#004848]">Carga rápida (Visita ya realizada)</p>
                  <p className="text-xs text-gray-500 font-medium">Registrá y cerrá una visita espontánea en 1 paso.</p>
                </div>
              </div>

              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Médico (Obligatorio)</label><input type="text" required list="lista-medicos" autoComplete="off" placeholder="Buscar..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Institución</label><input type="text" list="lista-instituciones" autoComplete="off" placeholder="Buscar..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Objetivo</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                
                {isCargaRapida && (
                  <div className="p-4 bg-[#f0f5ec] border border-[#88B830] rounded-xl flex flex-col gap-3 mt-2">
                    <p className="text-xs font-bold text-[#004848] uppercase tracking-wider">Resultados de la visita</p>
                    <div className="grid grid-cols-2 gap-3">
                      <select value={cierreData.duracion} onChange={(e) => setCierreData({...cierreData, duracion: Number(e.target.value)})} className="w-full bg-white border-gray-200 rounded-lg p-2.5 text-sm font-bold text-[#004848]">
                        <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
                      </select>
                      <select value={cierreData.logrado} onChange={(e) => setCierreData({...cierreData, logrado: e.target.value})} className="w-full bg-white border-gray-200 rounded-lg p-2.5 text-sm font-bold text-[#004848]">
                        <option value="si">Logrado</option><option value="no">No Logrado</option>
                      </select>
                    </div>
                    <textarea placeholder="Takeaways / Próximos pasos (Opcional)" rows={2} value={cierreData.takeaways} onChange={(e) => setCierreData({...cierreData, takeaways: e.target.value})} className="w-full bg-white border-gray-200 rounded-lg p-2.5 text-sm font-bold text-[#004848]"></textarea>
                  </div>
                )}

                {!isCargaRapida && (
                  <>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notas pre-visita</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]"></textarea></div>
                  </>
                )}

                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => {setShowModal(false); setIsCargaRapida(false)}} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="px-6 py-3 text-sm font-bold bg-[#88B830] text-[#004848] rounded-xl hover:bg-[#7aa62b] transition-colors shadow-sm">{isCargaRapida ? 'Guardar y Cerrar' : 'Agendar Visita'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL EDITAR PENDIENTE */}
        {visitaAEditar && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Editar Visita</h3>
              <form onSubmit={guardarEdicion} className="flex flex-col gap-4">
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Médico (Obligatorio)</label><input type="text" required list="lista-medicos" autoComplete="off" value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Institución</label><input type="text" list="lista-instituciones" autoComplete="off" value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Objetivo</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] font-bold text-[#004848]"></textarea></div>
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setVisitaAEditar(null)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="px-6 py-3 text-sm font-bold bg-[#004848] text-white rounded-xl hover:bg-[#003838] transition-colors shadow-sm">Guardar Cambios</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL AGREGAR NOTA (CERRADA) */}
        {visitaAAgregarNota && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
              <h3 className="text-2xl font-bold mb-2 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Agregar Comentario</h3>
              <p className="text-sm font-bold text-gray-500 mb-6">{visitaAAgregarNota.medico}</p>
              <form onSubmit={guardarNotaAdicional} className="flex flex-col gap-4">
                <textarea required placeholder="Escribí una nota o corrección adicional..." rows={4} value={notaAdicional} onChange={(e) => setNotaAdicional(e.target.value)} className="w-full bg-gray-50 border-gray-200 rounded-xl p-4 text-sm font-bold text-[#004848] focus:ring-[#88B830]"></textarea>
                <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setVisitaAAgregarNota(null)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="px-6 py-3 text-sm font-bold bg-[#004848] text-white rounded-xl hover:bg-[#003838] transition-colors shadow-sm">Agregar Nota</button>
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
                <select value={cierreData.resultado} onChange={(e) => setCierreData({...cierreData, resultado: e.target.value})} className="w-full bg-[#f0f5ec] border-[#88B830] rounded-xl p-4 text-sm font-bold text-[#004848] focus:ring-[#88B830]">
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

        {/* MODAL DETALLE DE VISITA (Reutilizado para mostrar y agregar notas) */}
        {visitaDetalle && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 relative">
              <button onClick={() => setVisitaDetalle(null)} className="absolute top-6 right-6 text-gray-400 hover:text-[#004848] text-2xl font-bold leading-none">&times;</button>
              
              <h3 className="text-2xl font-bold mb-2 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Detalle de Visita</h3>
              
              <div className="flex gap-3 items-center justify-between mb-6 border-b border-gray-100 pb-4">
                 <div>
                   <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${visitaDetalle.estado === 'pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : visitaDetalle.estado === 'realizada' ? 'bg-[#f0f5ec] text-[#004848] border-[#88B830]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{visitaDetalle.estado.toUpperCase()}</span>
                   <span className="text-sm font-bold text-gray-400 ml-3">{new Date(visitaDetalle.fecha_hora).toLocaleString('es-AR', { dateStyle:'long', timeStyle:'short' })}</span>
                 </div>
                 {visitaDetalle.estado !== 'pendiente' && (
                    <button onClick={() => {setVisitaDetalle(null); setVisitaAAgregarNota(visitaDetalle);}} className="text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">+ Nota</button>
                 )}
              </div>
              
              <div className="grid gap-4 text-[#004848]">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Médico e Institución</p>
                    <p className="font-bold text-xl mb-1">{visitaDetalle.medico}</p>
                    <p className="font-bold opacity-70">{visitaDetalle.institucion} {visitaDetalle.servicio && `- ${visitaDetalle.servicio}`}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Objetivo</p>
                      <p className="font-bold opacity-90">{visitaDetalle.objetivo || '-'}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Dirección</p>
                      <p className="font-bold opacity-90">{visitaDetalle.direccion || '-'}</p>
                  </div>
                </div>

                {visitaDetalle.notas && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notas Internas</p>
                      <p className="font-bold opacity-90 whitespace-pre-line">{visitaDetalle.notas}</p>
                  </div>
                )}
                
                {visitaDetalle.estado === 'realizada' && (
                  <div className="bg-[#f0f5ec] p-5 rounded-xl border border-[#88B830]">
                    <p className="text-xs font-bold text-[#004848] uppercase tracking-wider mb-3">Resultado de la visita</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <p><span className="font-bold opacity-70 block mb-1">Duración:</span> <span className="font-bold">{visitaDetalle.resultado_duracion} min</span></p>
                      <p><span className="font-bold opacity-70 block mb-1">Objetivo Logrado:</span> <span className="font-bold">{visitaDetalle.resultado_logrado ? 'Sí' : 'No'}</span></p>
                    </div>
                    {visitaDetalle.resultado_motivo && <p className="mb-3"><span className="font-bold opacity-70 block mb-1">Motivo:</span> <span className="font-bold">{visitaDetalle.resultado_motivo}</span></p>}
                    {visitaDetalle.resultado_takeaways && <p className="mb-3"><span className="font-bold opacity-70 block mb-1">Takeaways:</span> <span className="font-bold">{visitaDetalle.resultado_takeaways}</span></p>}
                    {(visitaDetalle.ubicacion_lat && visitaDetalle.ubicacion_lng) && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${visitaDetalle.ubicacion_lat},${visitaDetalle.ubicacion_lng}`} target="_blank" rel="noreferrer" className="inline-block mt-2 px-4 py-2 bg-white border border-[#88B830] text-[#004848] rounded-lg text-xs font-bold hover:bg-[#88B830] hover:text-white transition-colors">
                        📍 Ver en Google Maps
                      </a>
                    )}
                  </div>
                )}
                
                {(visitaDetalle.estado === 'cancelada' || visitaDetalle.estado === 'reprogramada') && (
                  <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">Motivo / Detalles</p>
                    <p className="font-bold text-orange-900">{visitaDetalle.resultado_motivo || '-'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
      <style dangerouslySetInnerHTML={{__html: `.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`}} />
    </main>
  )

  // Sub-componente para renderizar la tarjeta en las listas (Evita repetir código)
  function renderTarjetaVisita(visita: any) {
    return (
      <div key={visita.id} onClick={() => setVisitaDetalle(visita)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-[#88B830] transition-colors cursor-pointer">
        <div>
          <h3 className="font-bold text-[#004848] text-lg">{visita.medico}</h3>
          <p className="text-sm text-gray-500 font-bold">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
          <p className="text-xs text-gray-400 mt-1 font-bold">{new Date(visita.fecha_hora).toLocaleTimeString('es-AR', { timeStyle: 'short', dateStyle: isSearching ? 'short' : undefined })}</p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${visita.estado === 'pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : visita.estado === 'realizada' ? 'bg-[#f0f5ec] text-[#004848] border-[#88B830]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{visita.estado.toUpperCase()}</span>
          {visita.estado === 'pendiente' && (
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); abrirEdicion(visita); }} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 font-bold transition-colors">Editar</button>
              <button onClick={(e) => { e.stopPropagation(); setVisitaACerrar(visita); }} className="text-xs bg-[#004848] text-white px-4 py-2 rounded-xl hover:bg-[#003838] font-bold transition-colors">Cerrar</button>
            </div>
          )}
        </div>
      </div>
    )
  }
}