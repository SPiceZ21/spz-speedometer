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
  // Per-lap rewind allowance, in ms, pushed by spz-races. `rewindMax` of 0
  // means there is no lap in progress and the gauge is not drawn at all.
  rewindMax: number
  rewindLeft: number
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
  rewindMax: 0,
  rewindLeft: 0,
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

  // Allowance left, as a fraction. Drawn as remaining rather than consumed so
  // the gauge empties as it is spent, which is how a fuel or ammo gauge reads.
  const rewindPct = data.rewindMax > 0
    ? Math.max(0, Math.min(1, data.rewindLeft / data.rewindMax))
    : 0
  const rewindSecs = data.rewindLeft / 1000
  // Segmented rather than continuous: a partly-lit block is countable at a
  // glance, where a bar 40% along is not. Trailing segment lights partially so
  // the gauge still moves smoothly as the allowance drains.
  const RW_SEGS = 8
  const rewindSegs = Array.from({ length: RW_SEGS }, (_, i) =>
    Math.max(0, Math.min(1, rewindPct * RW_SEGS - i)))
  // Under a quarter left is the point at which a driver should stop assuming
  // another rewind is available.
  const rewindLow = data.rewindMax > 0 && rewindPct <= 0.25
  const rewindOut = data.rewindMax > 0 && data.rewindLeft <= 0

  // One flag slot, not three stacked ones. These states are mutually exclusive
  // in practice and only one can be acted on at a time.
  const flag = data.launch ? 'LC' : data.tcsCut ? 'TCS' : null

  return (
    <div class="hud-wrap">
      <div class="hud" data-red={data.inRedline} data-limiter={data.limiter} data-shifting={data.shifting}>
        {/* Rev bar. One line, one fill, a marked redline and a bright head —
            nothing else. It is the only element that moves fast enough to be
            read peripherally, so it gets the full width and no company. */}
        <div class="tach">
          <div class="tach-fill" style={{ width: `${data.pct}%` }} />
          <span class="tach-red" />
          {/* Boost rides under the bar as its own thin trace rather than
              claiming a row — same information, no extra furniture. */}
          {data.boost > 0.02 && (
            <div class="tach-boost" style={{ width: `${data.boost * 100}%` }} />
          )}
        </div>

        {/* Speed, with the gear as a small glyph beside it. No plate, no box:
            the gear is one character and never needed furniture to be found. */}
        <div class="main">
          <span class="speed">
            {data.speed}
            <i class="unit">KM/H</i>
          </span>

          <span class="gear" data-flag={flag ? flag.toLowerCase() : undefined}>
            {flag && <i class="flag">{flag}</i>}
            {data.gear}
          </span>
        </div>

        <div class="foot">
          {/* Indicators are drawn only while true — no row of dark
              placeholders. At rest the dash is revs, gear, speed. */}
          <div class="inds">
            {status.leftBlinker && <i class="ind arrow on">◀</i>}
            {(status.highbeams || status.lights) && (
              <i class={`ind ${status.highbeams ? 'on' : 'dim'}`}>▲</i>
            )}
            {status.handbrake && <i class="ind hb on">P</i>}
            {status.rightBlinker && <i class="ind arrow on">▶</i>}
          </div>

          {/* Rewind allowance — only while there is a lap to spend it on. */}
          {data.rewindMax > 0 && (
            <div class="rw" data-low={rewindLow} data-out={rewindOut}>
              <span class="rw-segs">
                {rewindSegs.map((fill, i) => (
                  <i key={i} class="rw-seg" style={{ '--f': fill } as any} />
                ))}
              </span>
              <span class="rw-val">{rewindOut ? 'SPENT' : `${rewindSecs.toFixed(1)}`}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
