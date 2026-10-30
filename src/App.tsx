import { useCallback, useEffect, useState } from 'react'
import { PaperBackground, type PaperVariant } from './components/PaperBackground'
import { DrawScreen } from './screens/DrawScreen'
import { GalleryScreen } from './screens/GalleryScreen'
import { HomeScreen } from './screens/HomeScreen'
import {
  loadRecentWords,
  pickCategory,
  rememberCategory,
  type Category,
} from './lib/categories'
import { loadClassifier } from './lib/classifier'
import { playSound, setSoundEnabled } from './lib/sound'
import {
  loadSoundPreference,
  loadStats,
  saveSoundPreference,
} from './lib/stats'
import { countArtworks } from './lib/storage'
import {
  applyTheme,
  loadTheme,
  nextTheme,
  saveTheme,
  type Theme,
} from './lib/theme'
import type { GameMode, Stats } from './lib/types'

type Screen = 'home' | 'draw' | 'gallery'

let sessionSequence = 0

function nextSessionId(): number {
  sessionSequence += 1
  return sessionSequence
}

function screenFromHash(): Screen {
  if (typeof window === 'undefined') return 'home'
  if (window.location.hash === '#gallery') return 'gallery'
  if (window.location.hash === '#draw') return 'draw'
  return 'home'
}

interface Session {
  id: number
  mode: GameMode
  category: Category | null
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash())
  const [session, setSession] = useState<Session | null>(null)
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [galleryCount, setGalleryCount] = useState(0)
  const [soundOn, setSoundOn] = useState(() => loadSoundPreference())
  const [theme, setTheme] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    setSoundEnabled(soundOn)
  }, [soundOn])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = nextTheme(current)
      saveTheme(next)
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const prefetch = () => {
      if (cancelled) return
      void loadClassifier().catch(() => {
        // The draw screen surfaces the error and offers a retry.
      })
    }
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const usedIdleCallback = typeof idleWindow.requestIdleCallback === 'function'
    const handle = usedIdleCallback
      ? idleWindow.requestIdleCallback!(prefetch, { timeout: 3000 })
      : window.setTimeout(prefetch, 1400)
    return () => {
      cancelled = true
      if (usedIdleCallback) idleWindow.cancelIdleCallback?.(handle)
      else window.clearTimeout(handle)
    }
  }, [])

  const refreshGalleryCount = useCallback(() => {
    void countArtworks()
      .then(setGalleryCount)
      .catch(() => setGalleryCount(0))
  }, [])

  useEffect(() => {
    refreshGalleryCount()
  }, [refreshGalleryCount])

  useEffect(() => {
    if (screen === 'home') refreshGalleryCount()
  }, [screen, refreshGalleryCount])

  const dealCategory = useCallback((excludeId?: string | null) => {
    const category = pickCategory(excludeId ?? null, loadRecentWords())
    rememberCategory(category.id)
    return category
  }, [])

  const startGame = useCallback(
    (mode: GameMode) => {
      setSession({
        id: nextSessionId(),
        mode,
        category: mode === 'challenge' ? dealCategory() : null,
      })
      setScreen('draw')
    },
    [dealCategory],
  )

  useEffect(() => {
    if (screen === 'draw' && !session) startGame('challenge')
  }, [screen, session, startGame])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const base = `${window.location.pathname}${window.location.search}`
    const desired = screen === 'home' ? '' : `#${screen}`
    if (window.location.hash === desired) return
    window.history.pushState(null, '', `${base}${desired}`)
  }, [screen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const next = screenFromHash()
      if (next === 'draw') {
        if (session) setScreen('draw')
        else startGame('challenge')
      } else {
        setScreen(next)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [session, startGame])


  const restart = useCallback(() => {
    if (!session) return
    const category =
      session.mode === 'challenge' ? dealCategory(session.category?.id) : null
    setSession({ id: nextSessionId(), mode: session.mode, category })
  }, [session, dealCategory])

  const handleGalleryCount = useCallback((count: number) => {
    setGalleryCount(count)
  }, [])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    saveSoundPreference(next)
    if (next) {
      setSoundEnabled(true)
      playSound('click')
    }
  }

  const variant: PaperVariant =
    screen === 'draw' ? 'draw' : screen === 'gallery' ? 'gallery' : 'home'
  const screenKey = screen === 'draw' ? `draw-${session?.id ?? 0}` : screen

  return (
    <div className="app">
      <PaperBackground variant={variant} />
      <div className="app__screen" key={screenKey}>
        {screen === 'home' ? (
          <HomeScreen
            stats={stats}
            galleryCount={galleryCount}
            soundOn={soundOn}
            theme={theme}
            onStart={startGame}
            onGallery={() => setScreen('gallery')}
            onToggleSound={toggleSound}
            onToggleTheme={toggleTheme}
          />
        ) : null}

        {screen === 'draw' && session ? (
          <DrawScreen
            key={session.id}
            mode={session.mode}
            category={session.category}
            soundOn={soundOn}
            theme={theme}
            onToggleSound={toggleSound}
            onToggleTheme={toggleTheme}
            onStatsChange={setStats}
            onHome={() => setScreen('home')}
            onGallery={() => setScreen('gallery')}
            onRestart={restart}
            onSaved={refreshGalleryCount}
          />
        ) : null}

        {screen === 'gallery' ? (
          <GalleryScreen
            theme={theme}
            onBack={() => setScreen('home')}
            onStart={() => startGame('challenge')}
            onCountChange={handleGalleryCount}
            onToggleTheme={toggleTheme}
          />
        ) : null}
      </div>
    </div>
  )
}
