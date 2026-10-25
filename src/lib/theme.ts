export type Theme = 'light' | 'dark'

const THEME_KEY = 'doodle-guess-theme-v1'

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (isTheme(saved)) return saved
  } catch {
    // Private mode or blocked storage: fall back to the system preference.
  }
  return systemTheme()
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Theme is cosmetic; ignore storage failures.
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.setProperty('color-scheme', theme)
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
