import type { Metadata } from 'next'
import { Montserrat, Nunito } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({ 
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700', '800']
})

const nunito = Nunito({ 
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '500', '600', '700']
})

export const metadata: Metadata = {
  title: 'Icom Salud - Agenda',
  description: 'Gestión de visitas médicas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${nunito.className} ${montserrat.variable} bg-[#f4f7f6] text-[#004848]`}>
        {children}
      </body>
    </html>
  )
}