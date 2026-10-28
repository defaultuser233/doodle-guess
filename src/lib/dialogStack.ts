interface DialogEntry {
  id: symbol
  onEscape: () => void
  panel: HTMLElement | null
}

const entries: DialogEntry[] = []
let listening = false
let originalOverflow: string | null = null

function focusableElements(panel: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(
    (element) =>
      element.getAttribute('aria-hidden') !== 'true' &&
      (element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element === document.activeElement),
  )
}

function handleKeyDown(event: KeyboardEvent): void {
  const top = entries[entries.length - 1]
  if (!top) return

  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    top.onEscape()
    return
  }

  if (event.key !== 'Tab' || !top.panel) return
  const panel = top.panel
  const items = focusableElements(panel)
  event.stopImmediatePropagation()
  if (items.length === 0) {
    event.preventDefault()
    panel.focus()
    return
  }

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  if (!panel.contains(active)) {
    event.preventDefault()
    first.focus()
    return
  }
  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function ensureListener(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  // Capture so the dialog stack wins over page-level shortcuts.
  window.addEventListener('keydown', handleKeyDown, true)
}

function syncScrollLock(): void {
  if (typeof document === 'undefined') return
  const background = document.querySelector<HTMLElement>('.app__screen')
  if (background) background.inert = entries.length > 0
  if (entries.length > 0 && originalOverflow === null) {
    originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else if (entries.length === 0 && originalOverflow !== null) {
    document.body.style.overflow = originalOverflow
    originalOverflow = null
  }
}

export function pushDialog(onEscape: () => void): symbol {
  ensureListener()
  const id = Symbol('dialog')
  entries.push({ id, onEscape, panel: null })
  syncScrollLock()
  return id
}

export function setDialogPanel(id: symbol, panel: HTMLElement | null): void {
  const entry = entries.find((item) => item.id === id)
  if (entry) entry.panel = panel
}

export function popDialog(id: symbol): void {
  const index = entries.findIndex((item) => item.id === id)
  if (index >= 0) entries.splice(index, 1)
  syncScrollLock()
}

export function hasOpenDialog(): boolean {
  return entries.length > 0
}
