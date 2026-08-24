import { useState, useEffect } from 'preact/hooks'

interface DashStatus {
  leftBlinker: boolean
  rightBlinker: boolean
  lights: boolean
  highbeams: boolean
  handbrake: boolean
}

interface SpeedoData {
  speed: number
  gear: number | string
  pct: number        // 0..100 across the rev range — computed client-Lua side,
                      // sourced from spz-physics when it's driving this car.
  inRedline: boolean
  shifting: boolean   // mid gear-change power cut
  limiter: boolean    // bouncing off the rev limiter
  launch: boolean     // launch control holding revs
  tcsCut: boolean      // traction control actively cutting power this frame
  boost: number       // 0..1 forced-induction spool, 0 on non-turbo cars
  status: DashStatus
}

const DEFAULT_STATUS: DashStatus = {
  leftBlinker: false,
  rightBlinker: false,
  lights: false,
  highbeams: false,
  handbrake: false,
}

const DEFAULT_DATA: SpeedoData = {
  speed: 0,
  gear: 1,
  pct: 0,
  inRedline: false,
  shifting: false,
  limiter: false,
  launch: false,
  tcsCut: false,
  boost: 0,
  status: DEFAULT_STATUS,
}

// Base theme (server.cfg spz_theme_* convars, pushed from spz-core) mapped
// onto this page's own CSS variable names (theme.css). Unknown/missing keys
// are a no-op since the stylesheet's own defaults still apply.
const THEME_VARS: Record<string, string> = {
  accent: '--color-primary',
  accent2: '--color-secondary',
  bg: '--bg-app',
  bg2: '--bg-card',
}
// rgba(...) glows/tints reference the accent as raw components so they can
// carry their own alpha — keep those in sync too.
const THEME_RGB_VARS: Record<string, string> = { accent: '--color-primary-rgb' }
function hexToRgbTriplet(hex?: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null
}
function applyTheme(theme?: Record<string, string>) {
  if (!theme) return
  for (const key in THEME_VARS) {
    if (theme[key]) document.documentElement.style.setProperty(THEME_VARS[key], theme[key])
  }
  for (const key in THEME_RGB_VARS) {
    const rgb = theme[key] && hexToRgbTriplet(theme[key])
    if (rgb) document.documentElement.style.setProperty(THEME_RGB_VARS[key], rgb)
  }
}

export function App() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<SpeedoData>(DEFAULT_DATA)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'update') setData({ ...DEFAULT_DATA, ...e.data, status: { ...DEFAULT_STATUS, ...e.data.status } })
      else if (e.data.type === 'show') setVisible(true)
      else if (e.data.type === 'hide') setVisible(false)
      else if (e.data.type === 'theme') applyTheme(e.data.theme)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (!visible) return null

  const { status } = data

  return (
    <div class="hud-wrap">
      <div class="speedo-container">
        {/* Rev counter as a continuous progress track, matching the checkpoint
            bar in the race HUD so the two read as the same instrument family. */}
        <div class="rpm-track" data-red={data.inRedline} data-limiter={data.limiter} data-shifting={data.shifting}>
          <div class="rpm-fill" style={{ width: `${data.pct}%` }} />
        </div>

        {data.boost > 0.02 && (
          <div class="boost-track">
            <div class="boost-fill" style={{ width: `${data.boost * 100}%` }} />
          </div>
        )}

        <div class="stats-row">
          <div class="indicators">
            <span class={`ind ind-arrow ind-left ${status.leftBlinker ? 'on' : ''}`}>◀</span>
            <span class={`ind ind-beam ${status.highbeams ? 'on' : status.lights ? 'dim' : ''}`}>▲</span>
            <span class={`ind ind-handbrake ${status.handbrake ? 'on' : ''}`}>P</span>
            <span class={`ind ind-arrow ind-right ${status.rightBlinker ? 'on' : ''}`}>▶</span>
          </div>

          <div class="gear-box" data-launch={data.launch} data-tcs-cut={data.tcsCut}>
            <span class="gear-val">{data.gear}</span>
            {data.launch && <span class="gear-flag">LC</span>}
            {data.tcsCut && !data.launch && <span class="gear-flag">TCS</span>}
          </div>
          <div class="speed-box">
            <span class="speed-val">{data.speed}</span>
            <span class="speed-unit">KM/H</span>
          </div>
        </div>

      </div>
    </div>
  )
}
