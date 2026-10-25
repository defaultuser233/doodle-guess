export type PaperVariant = 'home' | 'draw' | 'gallery'

interface PaperBackgroundProps {
  variant?: PaperVariant
}

export function PaperBackground({ variant = 'home' }: PaperBackgroundProps) {
  return (
    <div className={`paper-bg paper-bg--${variant}`} aria-hidden="true">
      <svg
        className="paper-bg__wash"
        viewBox="0 0 1440 960"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter
            id="watercolor-soft"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.02"
              numOctaves="3"
              seed="8"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="90"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <filter
            id="watercolor-soft-2"
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.02 0.03"
              numOctaves="4"
              seed="21"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="55"
              xChannelSelector="R"
              yChannelSelector="B"
            />
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <g
          filter="url(#watercolor-soft)"
          className="paper-bg__blobs paper-bg__blobs--back"
        >
          <ellipse cx="1120" cy="120" rx="390" ry="300" fill="var(--coral)" />
          <ellipse cx="150" cy="540" rx="310" ry="270" fill="var(--sky)" />
          <ellipse cx="720" cy="940" rx="430" ry="260" fill="var(--mustard)" />
          <ellipse cx="1280" cy="780" rx="280" ry="220" fill="var(--plum)" />
        </g>

        <g
          filter="url(#watercolor-soft-2)"
          className="paper-bg__blobs paper-bg__blobs--front"
        >
          <ellipse cx="240" cy="120" rx="190" ry="150" fill="var(--sage)" />
          <ellipse cx="900" cy="780" rx="220" ry="160" fill="var(--coral)" />
          <ellipse cx="1200" cy="520" rx="160" ry="120" fill="var(--sage)" />
        </g>
      </svg>
      <div className="paper-bg__grain" />
      <div className="paper-bg__vignette" />
    </div>
  )
}
