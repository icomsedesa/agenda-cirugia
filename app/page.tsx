'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Revisamos si ya hay una sesión activa al cargar la página
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) console.error('Error al iniciar sesión:', error.message)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">Agenda Cirugía</h1>
        <p className="text-sm text-gray-500 mb-8">Acceso exclusivo para Icom</p>
        <button 
          onClick={handleLogin}
          className="bg-blue-600 text-white font-medium py-2.5 px-4 rounded w-full hover:bg-blue-700 transition-colors"
        >
          Ingresar con Google
        </button>
      </div>
    </main>
  )
}