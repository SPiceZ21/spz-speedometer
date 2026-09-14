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

// All dial geometry uses one convention: degrees measured from straight up
// (12 o'clock), increasing clockwise — the same direction CSS rotate() turns,
// so the needle can be rotated by the same angle the scale is drawn at.
function pt(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) }
}
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = pt(cx, cy, r, startDeg)
  const e = pt(cx, cy, r, endDeg)
  let sweep = endDeg - startDeg
  if (sweep < 0) sweep += 360
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

// Layout, outside in: boost arc, blue band, tick scale, rev track, numbers.
const CX = 140, CY = 100
const SWEEP_START = -134, SWEEP_END = 134
const scaleDeg = (v: number) => SWEEP_START + (v / 10) * (SWEEP_END - SWEEP_START)

const BAND_R = 91
const TRACK_R = 77
const TRACK_W = 3.4
const NUM_R = 64
const NEEDLE_LEN = TRACK_R + TRACK_W / 2 + 1.5
// Left arc: the per-lap rewind allowance, drained bottom-up as it is spent.
const RW_R = 128, RW_START = -122, RW_END = -56, RW_ARC_SEGS = 4
const RED_FROM = 7.2, RED_TO = 10

// Static geometry — built once at load, not on every telemetry tick.
const BAND_SEGS = Array.from({ length: 10 }, (_, i) =>
  arcPath(CX, CY, BAND_R, scaleDeg(i) + 0.6, scaleDeg(i + 1) - 0.6))

// The tick scale lives inside the rev band itself. Minor ticks (four per
// step) sit within the band and are drawn under the fill, so they only show
// on the dark, not-yet-reached stretch. Major ticks cross the band and stand
// slightly proud of it, drawn over the fill.
const T_IN = TRACK_R - TRACK_W / 2
const T_OUT = TRACK_R + TRACK_W / 2
const MINOR_TICKS = Array.from({ length: 50 }, (_, i) => i)
  .filter(i => i % 5 !== 0)
  .map(i => {
    const a = scaleDeg(i / 5)
    return { p1: pt(CX, CY, T_IN + 0.5, a), p2: pt(CX, CY, T_OUT - 0.5, a) }
  })
const MAJOR_TICKS = Array.from({ length: 11 }, (_, v) => {
  const a = scaleDeg(v)
  return { v, p1: pt(CX, CY, T_IN - 0.8, a), p2: pt(CX, CY, T_OUT + 1.8, a) }
})
const NUMS = Array.from({ length: 11 }, (_, i) => pt(CX, CY, NUM_R, scaleDeg(i)))
const TRACK = arcPath(CX, CY, TRACK_R, SWEEP_START, SWEEP_END)
const RED_ZONE = arcPath(CX, CY, TRACK_R, scaleDeg(RED_FROM), scaleDeg(RED_TO))

// Inward-only glow: a strip just inside the band, painted with a radial
// gradient centred on the dial so it is brightest against the band's inner
// edge and fades to nothing toward the centre. A drop-shadow would bleed out
// past the band as well.
const GLOW_W = 6
const GLOW_R = T_IN - GLOW_W / 2
const GLOW_FROM = (T_IN - GLOW_W) / T_IN
const GLOW_MID = 1 - (1 - GLOW_FROM) * 0.35
const GLOW_TRACK = arcPath(CX, CY, GLOW_R, SWEEP_START, SWEEP_END)
const GLOW_RED = arcPath(CX, CY, GLOW_R, scaleDeg(RED_FROM), scaleDeg(RED_TO))
const RW_STEP = (RW_END - RW_START) / RW_ARC_SEGS
const RW_SEG_PATHS = Array.from({ length: RW_ARC_SEGS }, (_, i) =>
  arcPath(CX, CY, RW_R, RW_START + i * RW_STEP + 0.8, RW_START + (i + 1) * RW_STEP - 0.8))
// Seconds left, just below the bottom of the arc.
const RW_LABEL = pt(CX, CY, RW_R, RW_START - 7)
const NEEDLE = `${CX - 1.6},${CY} ${CX + 1.6},${CY} ${CX + 0.5},${CY - NEEDLE_LEN} ${CX - 0.5},${CY - NEEDLE_LEN}`

function arrow(deg: number, dir: -1 | 1) {
  const { x, y } = pt(CX, CY, BAND_R + 12, deg)
  return `${x + 4 * dir},${y} ${x - 3 * dir},${y - 4} ${x - 3 * dir},${y + 4}`
}
const ARROW_L = arrow(-38, -1)
const ARROW_R = arrow(38, 1)

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

  const rewindPct = data.rewindMax > 0
    ? Math.max(0, Math.min(1, data.rewindLeft / data.rewindMax))
    : 0
  const rewindSecs = Math.max(0, data.rewindLeft) / 1000
  const rewindOn  = data.rewindMax > 0
  const rewindLow = rewindOn && rewindPct <= 0.25
  const rewindOut = rewindOn && data.rewindLeft <= 0

  const flag = data.launch ? 'LC' : data.tcsCut ? 'TCS' : null

  const rev = Math.max(0, Math.min(1, data.pct / 100))

  return (
    <div class="hud-wrap">
      <div class="hud" data-red={data.inRedline} data-limiter={data.limiter} data-shifting={data.shifting}>
        <svg class="dial" viewBox="0 0 250 185">
          <defs>
            <radialGradient id="spz-face">
              <stop offset="0" class="face-s0" />
              <stop offset="0.72" class="face-s1" />
              <stop offset="1" class="face-s2" />
            </radialGradient>
            <linearGradient id="spz-needle" gradientUnits="userSpaceOnUse" x1={CX} y1={CY} x2={CX} y2={CY - NEEDLE_LEN}>
              <stop offset="0" class="needle-s0" />
              <stop offset="0.45" class="needle-s1" />
              <stop offset="1" class="needle-s2" />
            </linearGradient>
            <radialGradient id="spz-glow-w" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={T_IN}>
              <stop offset={GLOW_FROM} class="glow-w0" />
              <stop offset={GLOW_MID} class="glow-w1" />
              <stop offset="1" class="glow-w2" />
            </radialGradient>
            <radialGradient id="spz-glow-r" gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={T_IN}>
              <stop offset={GLOW_FROM} class="glow-r0" />
              <stop offset={GLOW_MID} class="glow-r1" />
              <stop offset="1" class="glow-r2" />
            </radialGradient>
          </defs>

          <circle cx={CX} cy={CY} r={BAND_R + 6} fill="url(#spz-face)" />

          {/* Rewind allowance for this lap, full at the top and draining down,
              segment by segment. The track stays drawn when no lap is running
              so the dial keeps its shape. */}
          <g class="rw-arc" data-on={rewindOn} data-low={rewindLow} data-out={rewindOut}>
            {RW_SEG_PATHS.map((d, i) => <path key={i} class="rw-track" d={d} />)}
            {rewindOn && RW_SEG_PATHS.map((d, i) => {
              const f = Math.max(0, Math.min(1, rewindPct * RW_ARC_SEGS - i))
              return f > 0.01 && (
                <path key={i} class="rw-fill" d={d} pathLength={1} style={{ strokeDasharray: `${f} 1` }} />
              )
            })}
            {rewindOn && (
              <text class="rw-val" x={RW_LABEL.x} y={RW_LABEL.y}>
                {rewindOut ? 'SPENT' : `${rewindSecs.toFixed(1)}s`}
              </text>
            )}
          </g>

          <g class="band">
            {BAND_SEGS.map((d, i) => <path key={i} d={d} />)}
          </g>

          {/* Layered bottom to top: dark band, minor ticks, white fill, red
              zone, major ticks. The fill covers the minor ticks as it rises;
              the red zone is drawn over the fill so revs inside it stay red. */}
          <path class="rev-track" d={TRACK} stroke-width={TRACK_W} />
          <g class="ticks-minor">
            {MINOR_TICKS.map((t, i) => <line key={i} x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} />)}
          </g>
          {rev > 0.005 && (
            <path class="rev-glow" d={GLOW_TRACK} stroke="url(#spz-glow-w)" stroke-width={GLOW_W} pathLength={1} style={{ strokeDasharray: `${rev} 1` }} />
          )}
          {rev > 0.005 && (
            <path class="rev-fill" d={TRACK} stroke-width={TRACK_W} pathLength={1} style={{ strokeDasharray: `${rev} 1` }} />
          )}
          <path class="red-glow" d={GLOW_RED} stroke="url(#spz-glow-r)" stroke-width={GLOW_W} />
          <path class="red-zone" d={RED_ZONE} stroke-width={TRACK_W} />
          <g class="ticks-major">
            {MAJOR_TICKS.map(t => (
              <line
                key={t.v}
                class={t.v <= rev * 10 && t.v < RED_FROM ? 'lit' : undefined}
                x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y}
              />
            ))}
          </g>

          <g class="nums">
            {NUMS.map((p, i) => <text key={i} x={p.x} y={p.y}>{i}</text>)}
          </g>

          <g class="needle" style={{ transform: `rotate(${scaleDeg(rev * 10)}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <polygon points={NEEDLE} fill="url(#spz-needle)" />
          </g>

          <g class="readout">
            <text class="t-rpm" x={CX} y={CY - 37}>RPM</text>
            <text class="t-rpmx" x={CX} y={CY - 30}>X1000</text>
            <text class="t-speed" x={CX} y={CY - 3}>{data.speed}</text>
            <text class="t-unit" x={CX} y={CY + 15}>km/h</text>
            <text class="t-gear" x={CX} y={CY + 35}>{data.gear}</text>
            {flag && (
              <g class={`t-flag ${flag.toLowerCase()}`}>
                <rect x={CX - 33} y={CY + 30.5} width={18} height={9} rx={1} />
                <text x={CX - 24} y={CY + 35}>{flag}</text>
              </g>
            )}
            {status.handbrake && <text class="t-hb" x={CX + 18} y={CY + 35}>P</text>}
          </g>

          {status.leftBlinker && <polygon class="blinker" points={ARROW_L} />}
          {status.rightBlinker && <polygon class="blinker" points={ARROW_R} />}
        </svg>
      </div>
    </div>
  )
}
