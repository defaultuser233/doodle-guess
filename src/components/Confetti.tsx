import type { CSSProperties } from 'react'

const COLORS = [
  '#F28C6B',
  '#F2B134',
  '#8FBF9F',
  '#7FB3D5',
  '#B58DB6',
  '#E4572E',
  '#FFFDF8',
]

const PIECES = Array.from({ length: 32 }, (_, index) => ({
  left: Math.random() * 100,
  delay: Math.random() * 0.4,
  duration: 1.1 + Math.random() * 0.9,
  drift: (Math.random() - 0.5) * 260,
  spin: 360 + Math.random() * 720,
  color: COLORS[index % COLORS.length],
  width: 6 + Math.random() * 8,
  height: 10 + Math.random() * 12,
}))

export function Confetti({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="confetti" aria-hidden="true">
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className="confetti__piece"
          style={
            {
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.height,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
