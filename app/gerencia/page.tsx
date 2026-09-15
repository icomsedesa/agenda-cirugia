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

  // Definición de equipos
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
      if (!perfil || (perfil.rol !== 'gerencia' && perfil.rol !== 'super_gerencia')) {
        router.push('/dashboard')
        return
      }
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
      cargarVisitas()
    }
  }

  if (cargando) return <div className="p-8 text-center">Cargando...</div>

  // Lógica de Filtro Inteligente según rol
  let listaVendedoresPermitidos = perfiles
  if (user.rol === 'gerencia') {
    const emailPrefix = user.email.split('@')[0].toLowerCase()
    const misVendedores = equipos[emailPrefix] || []
    listaVendedoresPermitidos = perfiles.filter(p => misVendedores.includes(p.email.split('@')[0].toLowerCase()))
  }

  const visitasFiltradas = vendedorSeleccionado === 'todos' 
    ? visitas.filter(v => listaVendedoresPermitidos.some(p => p.id === v.vendedor_id))
    : visitas.filter(v => v.vendedor_id === vendedorSeleccionado)

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      
      <datalist id="lista-medicos-gerencia">{listaMedicos.map((m, idx) => <option key={idx} value={m.nombre} />)}</datalist>
      <datalist id="lista-instituciones-gerencia">{listaInstituciones.map((i, idx) => <option key={idx} value={i.nombre} />)}</datalist>

      <div className="max-w-6xl mx-auto">
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
          <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded w-full md:w-auto">
            + Asignar visita
          </button>
        </div>

        <div className="grid gap-4">
          {visitasFiltradas.map((visita) => {
            const vendedor = perfiles.find(p => p.id === visita.vendedor_id)
            return (
              <div key={visita.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">{visita.medico}</h3>
                  <p className="text-sm font-medium text-indigo-600 mt-1">{vendedor?.nombre || vendedor?.email}</p>
                </div>
                <span className="bg-yellow-100 px-2 py-1 text-xs rounded">{visita.estado}</span>
              </div>
            )
          })}
        </div>

        {/* Modal (igual que Dashboard pero con selector de vendedor) */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
              <h3 className="text-lg font-bold mb-4">Asignar Visita</h3>
              <form onSubmit={guardarNuevaVisita} className="flex flex-col gap-4">
                <select required value={formData.vendedor_id} onChange={(e) => setFormData({...formData, vendedor_id: e.target.value})} className="w-full border rounded p-2">
                  <option value="" disabled>Seleccione vendedor...</option>
                  {listaVendedoresPermitidos.map(v => <option key={v.id} value={v.id}>{v.email}</option>)}
                </select>
                <input type="text" list="lista-medicos-gerencia" required placeholder="Médico..." value={formData.medico} onChange={(e) => setFormData({...formData, medico: e.target.value})} className="border rounded p-2" />
                <input type="text" list="lista-instituciones-gerencia" placeholder="Institución..." value={formData.institucion} onChange={(e) => setFormData({...formData, institucion: e.target.value})} className="border rounded p-2" />
                <input type="datetime-local" required value={formData.fecha} onChange={(e) => setFormData({...formData, fecha: e.target.value})} className="border rounded p-2" />
                <button type="submit" className="bg-blue-600 text-white rounded p-2">Guardar y Asignar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}