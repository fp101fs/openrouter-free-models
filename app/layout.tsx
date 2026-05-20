import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpenRouter Free Models',
  description: 'Browse, test, and export free models available on OpenRouter',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
