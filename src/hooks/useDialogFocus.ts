import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import {
  popDialog,
  pushDialog,
  setDialogPanel,
} from '../lib/dialogStack'

interface UseDialogFocusOptions {
  open: boolean
  onClose: () => void
  panelRef: RefObject<HTMLElement | null>
  initialFocusRef?: RefObject<HTMLElement | null>
  restoreFocus?: boolean
}

/**
 * Gives a modal dialog a place in the dialog stack: Escape only reaches the
 * topmost dialog, Tab is trapped inside it, focus is restored on close, and
 * the page scroll is locked while any dialog is open.
 */
export function useDialogFocus({
  open,
  onClose,
  panelRef,
  initialFocusRef,
  restoreFocus = true,
}: UseDialogFocusOptions): void {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const id = pushDialog(() => closeRef.current())
    const timer = window.setTimeout(() => {
      setDialogPanel(id, panelRef.current)
      const target = initialFocusRef?.current ?? panelRef.current
      target?.focus()
    }, 30)

    return () => {
      window.clearTimeout(timer)
      popDialog(id)
      if (restoreFocus && previous?.isConnected) previous.focus()
    }
  }, [open, panelRef, initialFocusRef, restoreFocus])
}
