import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function DialogPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
