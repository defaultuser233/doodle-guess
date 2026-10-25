import { useCallback, useEffect, useRef, useState } from 'react'

export function useToast(duration = 2600) {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const clearToast = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setToast(null)
  }, [])

  const showToast = useCallback(
    (message: string) => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      setToast(message)
      timer.current = window.setTimeout(() => {
        setToast(null)
        timer.current = null
      }, duration)
    },
    [duration],
  )

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  return { toast, showToast, clearToast }
}
