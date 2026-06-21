/**
 * app/layout.tsx
 *
 * Root layout. Deliberately minimal — auth gating and tenant resolution
 * happen in the nested route-group layouts below, not here, since the
 * root layout applies to marketing pages too (which need neither).
 */

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nordic Homes',
  description: 'Property management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
