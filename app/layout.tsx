import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Skills Dashboard',
  description: 'Track, monitor, and secure your AI skills and automation workflows',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080808] text-zinc-100 antialiased flex">
        <Sidebar />
        <div className="flex-1 ml-52 min-h-screen">{children}</div>
      </body>
    </html>
  )
}
