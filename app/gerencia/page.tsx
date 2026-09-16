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
  const [visitaDetalle, setVisitaDetalle] = useState<any>(null)

  const [formData, setFormData] = useState({ vendedor_id: '', institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
  
  const [vistaActiva, setVistaActiva] = useState<'lista' | 'semana' | 'mes'>('lista')
  const [fechaCalendario, setFechaCalendario] = useState(new Date())
  
  const router = useRouter()

  const equipos: Record<string, string[]> = {
    mdebernardo: ['amacchi', 'fbustos', 'jpetrone', 'jravazzoli', 'juanpablo', 'mcrespo', 'pedro', 'rmijaloski', 'rpetta', 'mdebernardo'],
    ppasciani: ['julieta', 'maria', 'micaela', 'nbriscioli', 'nicole', 'ppasciani'],
    ignacio: ['angelina', 'ffernandez', 'ignacio']
  }

  const colores = [
    'bg-blue-50 border-blue-200 text-blue-700', 'bg-rose-50 border-rose-200 text-rose-700',
    'bg-emerald-50 border-emerald-200 text-emerald-700', 'bg-purple-50 border-purple-200 text-purple-700',
    'bg-amber-50 border-amber-200 text-amber-700', 'bg-cyan-50 border-cyan-200 text-cyan-700',
    'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700', 'bg-lime-50 border-lime-200 text-lime-700'
  ]

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

      const { data } = await supabase.from('visitas').select('*').order('fecha_hora', { ascending: false })
      if (data) setVisitas(data)
      setCargando(false)
    }
    initData()
  }, [router])

  const cargarVisitas = async () => {
    const { data } = await supabase.from('visitas').select('*').order('fecha_hora', { ascending: false })
    if (data) setVisitas(data)
  }

  const exportarExcel = () => {
    const cabeceras = ['Fecha', 'Vendedor', 'Médico', 'Institución', 'Estado', 'Objetivo Logrado', 'Duración (min)', 'Motivo']
    const filas = visitasFiltradas.map(v => {
      const vendedor = perfiles.find(p => p.id === v.vendedor_id)
      return [new Date(v.fecha_hora).toLocaleDateString('es-AR'), vendedor ? (vendedor.nombre || vendedor.email) : 'Desconocido', v.medico, v.institucion || '', v.estado, v.resultado_logrado ? 'Sí' : (v.resultado_logrado === false ? 'No' : ''), v.resultado_duracion || '', v.resultado_motivo || ''].join(';')
    })
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [cabeceras.join(';'), ...filas].join('\n')
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `Reporte_Visitas.csv`)
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
  }

  const guardarNuevaVisita = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.vendedor_id) return alert("Por favor, seleccioná un vendedor.")
    await supabase.from('visitas').insert({
      vendedor_id: formData.vendedor_id, institucion: formData.institucion, servicio: formData.servicio,
      medico: formData.medico, objetivo: formData.objetivo, fecha_hora: new Date(formData.fecha).toISOString(),
      direccion: formData.direccion, notas: formData.notas, estado: 'pendiente'
    })
    if (formData.medico && !listaMedicos.some(m => m.nombre.toLowerCase() === formData.medico.toLowerCase())) await supabase.from('medicos').insert({ nombre: formData.medico })
    if (formData.institucion && !listaInstituciones.some(i => i.nombre.toLowerCase() === formData.institucion.toLowerCase())) await supabase.from('instituciones').insert({ nombre: formData.institucion })
    setShowModal(false); setFormData({ vendedor_id: '', institucion: '', servicio: '', medico: '', objetivo: '', fecha: '', direccion: '', notas: '' })
    cargarVisitas()
  }

  if (cargando) return <div className="p-8 text-center text-[#004848] font-bold tracking-wide">Cargando Panel Gerencial...</div>

  let listaVendedoresPermitidos = perfiles
  if (user.rol === 'gerencia') {
    const emailPrefix = user.email.split('@')[0].toLowerCase()
    const misVendedores = equipos[emailPrefix] || []
    listaVendedoresPermitidos = perfiles.filter(p => misVendedores.includes(p.email.split('@')[0].toLowerCase()))
  }

  const vendedoresOrdenados = [...listaVendedoresPermitidos].sort((a,b) => (a.nombre || a.email).localeCompare(b.nombre || b.email))
  const obtenerColorVendedor = (vendedor_id: string) => {
    const index = vendedoresOrdenados.findIndex(v => v.id === vendedor_id)
    return index >= 0 ? colores[index % colores.length] : 'bg-gray-50 border-gray-200 text-gray-700'
  }

  const visitasFiltradas = vendedorSeleccionado === 'todos' 
    ? visitas.filter(v => listaVendedoresPermitidos.some(p => p.id === v.vendedor_id))
    : visitas.filter(v => v.vendedor_id === vendedorSeleccionado)

  // LOGICA CALENDARIO 6 DÍAS (Lun-Sab)
  const esMismoDia = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
  const getLunes = (d: Date) => { const dd = new Date(d); const day = dd.getDay(); const diff = dd.getDate() - day + (day === 0 ? -6 : 1); return new Date(dd.getFullYear(), dd.getMonth(), diff) }
  
  // Mes 6 días
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
    if (d.getDay() !== 0) diasMes.push(d) // Excluir domingo
  }

  // Semana 6 días
  const lunesSemanaCal = getLunes(fechaCalendario)
  const diasSemanaCal = Array.from({length: 6}).map((_, i) => { const d = new Date(lunesSemanaCal); d.setDate(d.getDate() + i); return d })
  
  const cambiarMes = (offset: number) => setFechaCalendario(new Date(year, month + offset, 1))
  const cambiarSemanaCal = (offset: number) => { const d = new Date(fechaCalendario); d.setDate(d.getDate() + (offset * 7)); setFechaCalendario(d) }

  // LOGICA METRICAS
  const statsVendedores = vendedoresOrdenados.map(v => {
    const vVisitas = visitas.filter(vis => vis.vendedor_id === v.id)
    const plan = vVisitas.length
    const real = vVisitas.filter(vis => vis.estado === 'realizada').length
    const cumpl = plan > 0 ? Math.round((real / plan) * 100) : 0
    const objLog = vVisitas.filter(vis => vis.resultado_logrado === true).length
    const porcObj = real > 0 ? Math.round((objLog / real) * 100) : 0

    // Promedio Visitas / Día Hábil (Basado en los días hábiles del mes actual hasta hoy)
    const daysPassed = new Date().getDate()
    let workingDays = 0
    for(let i = 1; i <= daysPassed; i++) {
        if(new Date(new Date().getFullYear(), new Date().getMonth(), i).getDay() !== 0) workingDays++
    }
    workingDays = workingDays || 1 // Evitar división por cero
    const realCurrentMonth = vVisitas.filter(vis => vis.estado === 'realizada' && new Date(vis.fecha_hora).getMonth() === new Date().getMonth()).length
    const promDia = Number((realCurrentMonth / workingDays).toFixed(1))

    return { ...v, nombreDisplay: v.nombre || v.email.split('@')[0], plan, real, cumpl, objLog, porcObj, promDia }
  })

  const maxPromedio = Math.max(...statsVendedores.map(s => s.promDia), 1)

  return (
    <main className="min-h-screen bg-[#f4f7f6] p-4 md:p-8">
      <datalist id="lista-medicos-gerencia">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones-gerencia">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 border-l-4 !border-l-[#004848]">
          <div><h1 className="text-2xl font-bold text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Panel de Gerencia</h1><p className="text-sm text-gray-500 font-medium mt-1">{user.email}</p></div>
          <div className="flex gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-sm bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 px-5 py-2.5 rounded-xl transition-colors shadow-sm">Ir a mi Agenda</button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="text-sm bg-white border border-red-200 text-red-600 font-bold hover:bg-red-50 px-5 py-2.5 rounded-xl transition-colors shadow-sm">Cerrar sesión</button>
          </div>
        </div>

        {/* CONTROLES GLOBALES */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex gap-3 items-center w-full md:w-auto px-2">
            <label className="font-bold text-[#004848] text-xs uppercase tracking-wider">Equipo:</label>
            <span className="bg-[#f4f7f6] rounded-xl p-2.5 text-sm font-bold text-[#004848]">{user.rol === 'super_gerencia' ? 'Todo el equipo' : 'Mi equipo'}</span>
          </div>
          <div className="flex bg-[#f4f7f6] p-1.5 rounded-xl">
             <button onClick={() => setVistaActiva('lista')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${vistaActiva === 'lista' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Lista</button>
             <button onClick={() => setVistaActiva('semana')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${vistaActiva === 'semana' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Semana</button>
             <button onClick={() => setVistaActiva('mes')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${vistaActiva === 'mes' ? 'bg-white shadow-sm text-[#004848]' : 'text-gray-500 hover:text-gray-700'}`}>Mes</button>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={() => setShowModal(true)} className="bg-[#88B830] text-[#004848] text-sm font-bold py-3 px-6 rounded-xl hover:bg-[#7aa62b] shadow-sm transition-colors w-full md:w-auto">+ Asignar visita</button>
            <button onClick={exportarExcel} className="bg-[#004848] text-white text-sm font-bold py-3 px-6 rounded-xl hover:bg-[#003838] shadow-sm transition-colors w-full md:w-auto">⬇ Exportar Excel</button>
          </div>
        </div>

        {/* MÉTRICAS NUEVAS (Solo Gerencia) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Gráfico de Barras */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Ranking de Vendedores - Prom. Visitas/Día Hábil (Mes Actual)</h3>
            <div className="flex flex-col gap-4">
              {statsVendedores.map(v => (
                <div key={v.id} className="flex items-center gap-4">
                  <div className="w-32 text-right text-sm font-bold text-[#004848] truncate" title={v.nombreDisplay}>{v.nombreDisplay}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                    <div className="bg-[#88B830] h-full rounded-full transition-all duration-500" style={{ width: `${(v.promDia / maxPromedio) * 100}%` }}></div>
                  </div>
                  <div className="w-10 text-sm font-bold text-gray-500">{v.promDia}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de Detalle */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 overflow-x-auto">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Detalle por Vendedor (Histórico)</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs">Vendedor</th>
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs text-center">Plan.</th>
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs text-center">Real.</th>
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs text-center">% Cumpl.</th>
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs text-center">Obj. Log.</th>
                  <th className="pb-3 text-gray-400 font-bold uppercase text-xs text-center">% Obj.</th>
                </tr>
              </thead>
              <tbody>
                {statsVendedores.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 last:border-none">
                    <td className="py-3 font-bold text-[#004848]">{v.nombreDisplay}</td>
                    <td className="py-3 text-center font-bold text-gray-600">{v.plan}</td>
                    <td className="py-3 text-center font-bold text-[#88B830]">{v.real}</td>
                    <td className="py-3 text-center font-bold text-[#004848]">{v.cumpl}%</td>
                    <td className="py-3 text-center font-bold text-gray-600">{v.objLog}</td>
                    <td className="py-3 text-center font-bold text-[#88B830]">{v.porcObj}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* BOTONERA DE FILTROS POR VENDEDOR */}
        <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Filtro por Vendedor:</span>
          <button onClick={() => setVendedorSeleccionado('todos')} className={`text-xs font-bold px-4 py-2 rounded-xl border shadow-sm transition-all ${vendedorSeleccionado === 'todos' ? 'bg-[#004848] text-white border-[#004848]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>Todos</button>
          {vendedoresOrdenados.map(v => (
            <button key={v.id} onClick={() => setVendedorSeleccionado(v.id)} className={`text-xs font-bold px-4 py-2 rounded-xl border shadow-sm transition-all cursor-pointer ${obtenerColorVendedor(v.id)} ${vendedorSeleccionado !== 'todos' && vendedorSeleccionado !== v.id ? 'opacity-40 grayscale hover:grayscale-0' : 'hover:scale-105'}`}>
              {v.nombreDisplay}
            </button>
          ))}
        </div>

        {/* VISTA: LISTA */}
        {vistaActiva === 'lista' && (
          <div className="grid gap-4">
            {visitasFiltradas.map((visita) => {
              const vendedor = perfiles.find(p => p.id === visita.vendedor_id)
              return (
                <div key={visita.id} onClick={() => setVisitaDetalle(visita)} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 ${obtenerColorVendedor(visita.vendedor_id).split(' ')[0].replace('bg-', 'border-')} flex flex-col md:flex-row justify-between md:items-center gap-4 hover:shadow-md transition-shadow cursor-pointer`}>
                  <div>
                    <h3 className="font-bold text-[#004848] text-lg">{visita.medico}</h3>
                    <p className="text-sm text-gray-500 font-bold">{visita.institucion} {visita.servicio && `- ${visita.servicio}`}</p>
                    <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">Vendedor: {vendedor?.nombre || vendedor?.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                     <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${visita.estado === 'pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : visita.estado === 'realizada' ? 'bg-[#f0f5ec] text-[#004848] border-[#88B830]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{visita.estado.toUpperCase()}</span>
                    <span className="text-xs font-bold text-gray-400">{new Date(visita.fecha_hora).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' })}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* VISTA: MES (6 columnas Lun-Sab) */}
        {vistaActiva === 'mes' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => cambiarMes(-1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&lt;</button>
              <h2 className="text-xl font-bold text-[#004848] capitalize" style={{fontFamily: 'var(--font-montserrat)'}}>{fechaCalendario.toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h2>
              <button onClick={() => cambiarMes(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {['Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <div key={d} className="text-center font-bold text-gray-400 text-xs py-2">{d}</div>)}
              {diasMes.map((dia, idx) => (
                <div key={idx} className={`min-h-[120px] p-2 border rounded-xl ${dia ? 'bg-white border-gray-100' : 'bg-gray-50 border-transparent'}`}>
                  {dia && (
                    <>
                      <div className="text-right text-xs font-bold text-gray-400 mb-2 pr-1">{dia.getDate()}</div>
                      <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                        {visitasFiltradas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                          <div key={v.id} onClick={() => setVisitaDetalle(v)} className={`text-[10px] font-bold leading-tight p-1.5 rounded-lg border truncate cursor-pointer hover:opacity-75 ${obtenerColorVendedor(v.vendedor_id)}`} title={`${v.medico} - ${v.institucion}`}>
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

        {/* VISTA: SEMANA (6 columnas Lun-Sab) */}
        {vistaActiva === 'semana' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 overflow-x-auto">
             <div className="flex justify-between items-center mb-8 min-w-[700px]">
              <button onClick={() => cambiarSemanaCal(-1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&lt;</button>
              <h2 className="text-xl font-bold text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Semana del {diasSemanaCal[0].toLocaleDateString('es-AR')} al {diasSemanaCal[5].toLocaleDateString('es-AR')}</h2>
              <button onClick={() => cambiarSemanaCal(1)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-colors font-bold">&gt;</button>
            </div>
            <div className="grid grid-cols-6 gap-4 min-w-[700px]">
              {diasSemanaCal.map((dia, idx) => (
                <div key={idx} className="flex flex-col gap-3">
                  <div className={`text-center pb-3 border-b-2 ${esMismoDia(dia, new Date()) ? 'border-[#88B830]' : 'border-gray-50'}`}>
                    <span className={`block text-xs font-bold mb-1 ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-400'}`}>{['Lun','Mar','Mié','Jue','Vie','Sáb'][idx]}</span>
                    <span className={`text-2xl font-bold ${esMismoDia(dia, new Date()) ? 'text-[#004848]' : 'text-gray-600'}`}>{dia.getDate()}</span>
                  </div>
                  <div className="flex flex-col gap-2.5 min-h-[300px]">
                    {visitasFiltradas.filter(v => esMismoDia(new Date(v.fecha_hora), dia)).map(v => (
                      <div key={v.id} onClick={() => setVisitaDetalle(v)} className={`text-xs p-3 rounded-xl border shadow-sm hover:opacity-80 transition-opacity cursor-pointer ${obtenerColorVendedor(v.vendedor_id)}`}>
                        <div className="font-bold truncate text-[13px]" title={v.medico}>{v.medico}</div>
                        <div className="truncate opacity-70 font-bold mt-0.5" title={v.institucion}>{v.institucion}</div>
                        <div className="mt-2 font-bold opacity-60">{new Date(v.fecha_hora).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODALES OMITIDOS PARA BREVEDAD (Asignar y Detalle siguen idénticos al anterior) */}
        {/* Aquí van los 2 modales de la versión anterior */}
        {/* MODAL ASIGNAR VISITA */}
        {showModal && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-8">
              <h3 className="text-2xl font-bold mb-6 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Asignar Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Vendedor (Obligatorio)</label>
                  <select required value={formData.vendedor_id} onChange={(e) => setFormData({...formData, vendedor_id: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]">
                    <option value="" disabled>Seleccione vendedor...</option>
                    {vendedoresOrdenados.map(v => <option key={v.id} value={v.id}>{v.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Médico (Obligatorio)</label>
                  <input type="text" required list="lista-medicos-gerencia" autoComplete="off" placeholder="Buscar o crear nuevo..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Institución</label><input type="text" list="lista-instituciones-gerencia" autoComplete="off" placeholder="Buscar..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Servicio</label><input type="text" value={formData.servicio} onChange={(e) => setFormData({...formData, servicio: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                </div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Fecha y Hora</label><input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Objetivo</label><input type="text" value={formData.objetivo} onChange={(e) => setFormData({...formData, objetivo: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Dirección</label><input type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]" /></div>
                <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notas</label><textarea rows={2} value={formData.notas} onChange={(e) => setFormData({...formData, notas: e.target.value})} className="w-full bg-gray-50 border-gray-200 rounded-xl p-3 text-sm focus:ring-[#88B830] focus:border-[#88B830] font-bold text-[#004848]"></textarea></div>
                <div className="flex gap-3 justify-end mt-4 pt-5 border-t border-gray-100"><button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancelar</button><button type="submit" className="px-6 py-3 text-sm font-bold bg-[#88B830] text-[#004848] rounded-xl hover:bg-[#7aa62b] shadow-sm transition-colors">Guardar y Asignar</button></div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DETALLE DE VISITA */}
        {visitaDetalle && (
          <div className="fixed inset-0 bg-[#004848]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 relative">
              <button onClick={() => setVisitaDetalle(null)} className="absolute top-6 right-6 text-gray-400 hover:text-[#004848] text-2xl font-bold leading-none">&times;</button>
              
              <h3 className="text-2xl font-bold mb-2 text-[#004848]" style={{fontFamily: 'var(--font-montserrat)'}}>Detalle de Visita</h3>
              
              <div className="flex gap-3 items-center mb-6 border-b border-gray-100 pb-4">
                 <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${visitaDetalle.estado === 'pendiente' ? 'bg-orange-50 text-orange-700 border-orange-200' : visitaDetalle.estado === 'realizada' ? 'bg-[#f0f5ec] text-[#004848] border-[#88B830]' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{visitaDetalle.estado.toUpperCase()}</span>
                 <span className="text-sm font-bold text-gray-400">{new Date(visitaDetalle.fecha_hora).toLocaleString('es-AR', { dateStyle:'long', timeStyle:'short' })}</span>
              </div>
              
              <div className="grid gap-4 text-[#004848]">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Médico e Institución</p>
                    <p className="font-bold text-xl mb-1">{visitaDetalle.medico}</p>
                    <p className="font-bold opacity-70">{visitaDetalle.institucion} {visitaDetalle.servicio && `- ${visitaDetalle.servicio}`}</p>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vendedor Asignado</p>
                    <p className="font-bold text-lg">{perfiles.find(p => p.id === visitaDetalle.vendedor_id)?.nombre || perfiles.find(p => p.id === visitaDetalle.vendedor_id)?.email || visitaDetalle.vendedor_id}</p>
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
                      <p className="font-bold opacity-90">{visitaDetalle.notas}</p>
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
                    <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">Detalles / Reprogramación</p>
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
}