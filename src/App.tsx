import { useCallback, useEffect, useState } from 'react'
import { PaperBackground, type PaperVariant } from './components/PaperBackground'
import { DrawScreen } from './screens/DrawScreen'
import { GalleryScreen } from './screens/GalleryScreen'
import { HomeScreen } from './screens/HomeScreen'
import { pickCategory, type Category } from './lib/categories'
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

interface Session {
  id: number
  mode: GameMode
  category: Category | null
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
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
    void loadClassifier().catch(() => {
      // The draw screen surfaces the error and offers a retry.
    })
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

  const startGame = useCallback((mode: GameMode) => {
    setSession({
      id: Date.now(),
      mode,
      category: mode === 'challenge' ? pickCategory() : null,
    })
    setScreen('draw')
  }, [])

  const restart = useCallback(() => {
    setSession((current) => {
      if (!current) return current
      return {
        id: Date.now(),
        mode: current.mode,
        category:
          current.mode === 'challenge'
            ? pickCategory(current.category?.id)
            : null,
      }
    })
  }, [])

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
