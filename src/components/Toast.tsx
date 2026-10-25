interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      className={`toast${message ? ' is-visible' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
