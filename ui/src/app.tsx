import { useState, useEffect, useRef } from 'preact/hooks'

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

// Layout, outside in: accent band, tick scale, rev track, numbers.
//
// `boost` is still in the payload and is deliberately NOT drawn: there is no
// room for an arc on the right of this viewBox (CX is 140 of 250, so the right
// side has 110 units against the left's 140, and the band already reaches 233),
// and shrinking one to fit made it an obviously unequal pair with the rewind
// arc rather than a mirror of it.
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
// Tapered from hub to tip. Widened from 3.2/1.0 to 4.6/1.7: at the old width
// the needle was a hairline against a 250-unit dial and lost its edge entirely
// under the glow, which is the opposite of what a glow is for.
const NEEDLE_W_HUB = 2.3
const NEEDLE_W_TIP = 0.85
const NEEDLE = [
  `${CX - NEEDLE_W_HUB},${CY}`,
  `${CX + NEEDLE_W_HUB},${CY}`,
  `${CX + NEEDLE_W_TIP},${CY - NEEDLE_LEN}`,
  `${CX - NEEDLE_W_TIP},${CY - NEEDLE_LEN}`,
].join(' ')

function arrow(deg: number, dir: -1 | 1) {
  const { x, y } = pt(CX, CY, BAND_R + 12, deg)
  return `${x + 4 * dir},${y} ${x - 3 * dir},${y - 4} ${x - 3 * dir},${y + 4}`
}
const ARROW_L = arrow(-38, -1)
const ARROW_R = arrow(38, 1)

/* ── Motion ─────────────────────────────────────────────────────────────────
 *
 * The dial is fed at 20 Hz from client/main.lua. It used to treat each message
 * as a position to be at immediately and bridge the 50 ms gap with a 70 ms CSS
 * transition — so the transition never finished before the next sample replaced
 * it, and the needle was permanently chasing. That is what read as stepped.
 *
 * The samples are TARGETS now, and the displayed values are eased toward them
 * in one rAF loop that writes straight to the DOM. Same structure as
 * CPDistancePill in spz-raceUI, including the reason the CSS transitions had to
 * come off with it: script easing plus a transition is a second filter chasing
 * the first.
 */

// The needle is a SPRING, not a lerp, because a needle has mass. Critical
// damping for this stiffness is 2*sqrt(260) ≈ 32, so 22 is deliberately under
// it — that gap is the overshoot you see on a throttle blip and the bounce on
// an upshift. Raise DAMPING toward 32 to take the bounce out without touching
// anything else; lower it for a looser, older-gauge feel.
const NEEDLE_STIFFNESS = 260
const NEEDLE_DAMPING   = 22

// A frame hitch, or a tab that was backgrounded and came back, hands rAF a huge
// delta. Integrating it would fling the needle across the dial and take a
// second to settle, so dt is capped at one 30fps frame.
const MAX_DT = 1 / 30

// Speed gets a plain lerp, NOT a spring: a readout that overshoots is a readout
// displaying a number the car is not doing. 0.25/frame settles in ~4 frames —
// enough to smooth the 20 Hz sampling, not enough to lie.
const SPEED_EASE = 0.25

/* ── Ignition sweep ─────────────────────────────────────────────────────────
 * The cluster self-test: needle to full and back when you take the seat.
 */
const SWEEP_ENABLED = true
const SWEEP_UP = 450, SWEEP_HOLD = 120, SWEEP_DOWN = 580
const SWEEP_TOTAL = SWEEP_UP + SWEEP_HOLD + SWEEP_DOWN

// Above this the sweep is skipped entirely. Getting in already at speed is a
// mid-race respawn or a passenger taking the wheel, and running a self-test at
// 180 km/h hides live data for over a second at exactly the wrong moment.
const SWEEP_MAX_ENTRY_SPEED = 5

const easeOut    = (t: number) => 1 - Math.pow(1 - t, 3)
const easeInOut  = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Sweep position 0..1 at `ms` into the sweep, or null once it is over. */
function sweepAt(ms: number): number | null {
  if (ms < SWEEP_UP) return easeOut(ms / SWEEP_UP)
  if (ms < SWEEP_UP + SWEEP_HOLD) return 1
  if (ms < SWEEP_TOTAL) return 1 - easeInOut((ms - SWEEP_UP - SWEEP_HOLD) / SWEEP_DOWN)
  return null
}

// Shift-light tiers on the outer band, as segment indices (0-9).
const BAND_WARN = 7   // amber from here
const BAND_RED  = 9   // red from here

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/* ── Discrete state ─────────────────────────────────────────────────────────
 * Everything that is NOT eased. Kept apart from the continuous channels so the
 * component can skip re-rendering entirely while only revs and speed move.
 */
type Phase = 'pending' | 'sweep' | 'live'

interface Discrete {
  gear: number | string
  inRedline: boolean
  shifting: boolean
  limiter: boolean
  launch: boolean
  tcsCut: boolean
  rewindMax: number
  rewindLeft: number
  status: DashStatus
}

const DEFAULT_DISCRETE: Discrete = {
  gear: 1,
  inRedline: false,
  shifting: false,
  limiter: false,
  launch: false,
  tcsCut: false,
  rewindMax: 0,
  rewindLeft: 0,
  status: DEFAULT_STATUS,
}

/** Cheap enough to run on every message, and it is what buys the zero-rerender
 *  cruise: the state updater returns the previous object when nothing moved. */
function sameDiscrete(a: Discrete, b: Discrete): boolean {
  return a.gear === b.gear
    && a.inRedline === b.inRedline
    && a.shifting === b.shifting
    && a.limiter === b.limiter
    && a.launch === b.launch
    && a.tcsCut === b.tcsCut
    && a.rewindMax === b.rewindMax
    && a.rewindLeft === b.rewindLeft
    && a.status.leftBlinker === b.status.leftBlinker
    && a.status.rightBlinker === b.status.rightBlinker
    && a.status.lights === b.status.lights
    && a.status.highbeams === b.status.highbeams
    && a.status.handbrake === b.status.handbrake
}

export function App() {
  const [visible, setVisible] = useState(false)
  /*
   * State is split in two, and the split is the performance story.
   *
   * DISCRETE — gear, flags, indicators, rewind. These change a handful of times
   * a lap, so they live in Preact state and the updater returns `prev`
   * unchanged when nothing differs. Holding a steady throttle now costs ZERO
   * re-renders; it used to re-render the whole SVG twenty times a second
   * whether anything had changed or not.
   *
   * CONTINUOUS — rev and speed. Refs, eased in the rAF loop below, written
   * straight to the DOM. These never re-render anything.
   */
  const [d, setD] = useState<Discrete>(DEFAULT_DISCRETE)

  const target = useRef({ rev: 0, speed: 0 })
  const shown  = useRef({ rev: 0, vel: 0, speed: 0 })

  const phase    = useRef<Phase>('live')
  const sweepT0  = useRef(0)

  const needleEl = useRef<SVGGElement | null>(null)
  const fillEl   = useRef<SVGPathElement | null>(null)
  const glowEl   = useRef<SVGPathElement | null>(null)
  const speedEl  = useRef<SVGTextElement | null>(null)
  const bandEls  = useRef<(SVGPathElement | null)[]>([])
  const tickEls  = useRef<(SVGLineElement | null)[]>([])
  // Lit-segment count is an integer 0-10, so it changes a few times per gear
  // rather than every frame. Tracking it is what keeps the shift lights off the
  // per-frame DOM-write path entirely.
  const lastLit  = useRef(-1)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const m = e.data
      if (!m) return

      if (m.type === 'update') {
        target.current.rev   = clamp01((m.pct ?? 0) / 100)
        target.current.speed = m.speed ?? 0

        /*
         * The sweep is decided HERE and not on `show`, because client/main.lua
         * sends `show` and the first `update` in the same tick — at `show` time
         * there is no speed to test yet.
         */
        if (phase.current === 'pending') {
          const entrySpeed = m.speed ?? 0
          if (SWEEP_ENABLED && entrySpeed <= SWEEP_MAX_ENTRY_SPEED) {
            phase.current = 'sweep'
            sweepT0.current = performance.now()
          } else {
            // Already moving: adopt the live values outright rather than easing
            // up to them from zero, which would read as the car accelerating
            // from a standstill it is not at.
            phase.current = 'live'
            shown.current.rev   = target.current.rev
            shown.current.speed = target.current.speed
            shown.current.vel   = 0
          }
        }

        const next: Discrete = {
          gear:       m.gear ?? 1,
          inRedline:  !!m.inRedline,
          shifting:   !!m.shifting,
          limiter:    !!m.limiter,
          launch:     !!m.launch,
          tcsCut:     !!m.tcsCut,
          rewindMax:  m.rewindMax ?? 0,
          rewindLeft: m.rewindLeft ?? 0,
          status:     { ...DEFAULT_STATUS, ...m.status },
        }
        setD(prev => (sameDiscrete(prev, next) ? prev : next))

      } else if (m.type === 'show') {
        // Armed, not started — see the note in the update branch.
        phase.current   = 'pending'
        lastLit.current = -1
        shown.current   = { rev: 0, vel: 0, speed: 0 }
        setVisible(true)

      } else if (m.type === 'hide') {
        setVisible(false)
      } else if (m.type === 'theme') {
        applyTheme(m.theme)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  /*
   * One rAF loop drives everything continuous. It writes to the DOM directly —
   * a setState per frame would re-render the whole dial sixty times a second to
   * move a needle a fraction of a degree, which is the thing this replaced.
   *
   * Hooks run unconditionally and the visibility test happens after them; the
   * refs are null while hidden, and every write below is guarded on that.
   */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)

      const dt = Math.min((now - last) / 1000, MAX_DT)
      last = now

      const s = shown.current
      const t = target.current

      // ── Rev ──────────────────────────────────────────────────────────────
      if (phase.current === 'sweep') {
        const p = sweepAt(now - sweepT0.current)
        if (p === null) {
          /*
           * Handover. The spring is seeded at rest at zero rather than at the
           * live value, so it springs UP to whatever the engine is doing — the
           * handover is the needle catching the engine, which is what an
           * instrument cluster actually does when the self-test ends. There is
           * no discontinuity to hide because there is no jump.
           */
          phase.current = 'live'
          s.rev = 0
          s.vel = 0
        } else {
          s.rev = p
          s.vel = 0
        }
      } else if (phase.current === 'live') {
        const a = (t.rev - s.rev) * NEEDLE_STIFFNESS - s.vel * NEEDLE_DAMPING
        s.vel += a * dt
        s.rev += s.vel * dt
      }
      // 'pending' holds at rest: the cluster has been asked for but the first
      // telemetry has not arrived, so there is nothing honest to show yet.

      // Clamped for DRAWING only. The spring state keeps its overshoot so it
      // settles naturally instead of sticking to the rail.
      const rev = clamp01(s.rev)

      // ── Speed ────────────────────────────────────────────────────────────
      s.speed += (t.speed - s.speed) * SPEED_EASE

      // ── Write ────────────────────────────────────────────────────────────
      const needle = needleEl.current
      if (!needle) return                       // hidden: nothing is mounted

      needle.style.transform = `rotate(${scaleDeg(rev * 10).toFixed(2)}deg)`

      const dash = `${rev.toFixed(4)} 1`
      if (fillEl.current) fillEl.current.style.strokeDasharray = dash
      if (glowEl.current) glowEl.current.style.strokeDasharray = dash

      if (speedEl.current) {
        const v = String(Math.round(s.speed))
        // textContent is compared before writing: assigning the same string
        // still dirties the node and costs a layout pass on an SVG text run.
        if (speedEl.current.textContent !== v) speedEl.current.textContent = v
      }

      // ── Shift lights ─────────────────────────────────────────────────────
      const lit = Math.min(10, Math.floor(rev * 10 + 1e-6))
      if (lit !== lastLit.current) {
        lastLit.current = lit
        for (let i = 0; i < 10; i++) {
          const el = bandEls.current[i]
          if (!el) continue
          const cls = i >= lit ? ''
            : i >= BAND_RED ? 'lit red'
            : i >= BAND_WARN ? 'lit warn'
            : 'lit'
          if (el.getAttribute('class') !== cls) el.setAttribute('class', cls)
        }
        // A major tick the fill has passed shows as a grey notch in the white.
        // Same threshold, so it moves with the band rather than a frame behind.
        for (let v = 0; v <= 10; v++) {
          const el = tickEls.current[v]
          if (!el) continue
          const cls = v <= lit && v < RED_FROM ? 'lit' : ''
          if (el.getAttribute('class') !== cls) el.setAttribute('class', cls)
        }
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  /*
   * Re-render counter, DEV only — folded out of the production bundle.
   *
   * It exists because "the dial no longer re-renders while you hold a steady
   * throttle" is the entire justification for splitting the state in two, and
   * that claim is invisible from looking at the screen. `window.__renders`
   * should stay flat while spz.drive() runs at a constant gear and tick only
   * when something discrete actually changes.
   */
  if (import.meta.env.DEV) {
    ;(window as any).__renders = ((window as any).__renders || 0) + 1
  }

  if (!visible) return null

  const { status } = d

  const rewindPct = d.rewindMax > 0
    ? Math.max(0, Math.min(1, d.rewindLeft / d.rewindMax))
    : 0
  const rewindSecs = Math.max(0, d.rewindLeft) / 1000
  const rewindOn  = d.rewindMax > 0
  const rewindLow = rewindOn && rewindPct <= 0.25
  const rewindOut = rewindOn && d.rewindLeft <= 0

  const flag = d.launch ? 'LC' : d.tcsCut ? 'TCS' : null

  return (
    <div class="hud-wrap">
      <div class="hud" data-red={d.inRedline} data-limiter={d.limiter} data-shifting={d.shifting}>
        <svg class="dial" viewBox="0 0 250 185">
          <defs>
            <radialGradient id="spz-face">
              <stop offset="0" class="face-s0" />
              <stop offset="0.72" class="face-s1" />
              <stop offset="1" class="face-s2" />
            </radialGradient>
            {/* Runs hub -> tip in user space, and the CSS rotation on the
                needle group carries the gradient with it, so the fade stays
                anchored to the hub at every angle. Offsets are spread wide on
                purpose — see .needle-s* in app.css. */}
            <linearGradient id="spz-needle" gradientUnits="userSpaceOnUse" x1={CX} y1={CY} x2={CX} y2={CY - NEEDLE_LEN}>
              <stop offset="0" class="needle-s0" />
              <stop offset="0.34" class="needle-s1" />
              <stop offset="0.74" class="needle-s2" />
              <stop offset="1" class="needle-s3" />
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
            {RW_SEG_PATHS.map((path, i) => <path key={i} class="rw-track" d={path} />)}
            {rewindOn && RW_SEG_PATHS.map((path, i) => {
              const f = Math.max(0, Math.min(1, rewindPct * RW_ARC_SEGS - i))
              return f > 0.01 && (
                <path key={i} class="rw-fill" d={path} pathLength={1} style={{ strokeDasharray: `${f} 1` }} />
              )
            })}
            {rewindOn && (
              <text class="rw-val" x={RW_LABEL.x} y={RW_LABEL.y}>
                {rewindOut ? 'SPENT' : `${rewindSecs.toFixed(1)}s`}
              </text>
            )}
          </g>

          {/* Outer band: a sequential shift light, not decoration. Segments are
              lit by the rAF loop, which only touches them when the lit COUNT
              changes. */}
          <g class="band">
            {BAND_SEGS.map((path, i) => (
              <path key={i} d={path} ref={el => { bandEls.current[i] = el }} />
            ))}
          </g>

          {/* Layered bottom to top: dark band, minor ticks, white fill, red
              zone, major ticks. The fill covers the minor ticks as it rises;
              the red zone is drawn over the fill so revs inside it stay red. */}
          <path class="rev-track" d={TRACK} stroke-width={TRACK_W} />
          <g class="ticks-minor">
            {MINOR_TICKS.map((t, i) => <line key={i} x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y} />)}
          </g>
          {/* Always mounted, driven by strokeDasharray — mounting and unmounting
              these at a rev threshold was a re-render on the busiest value on
              the dial. A dasharray of 0 draws nothing. */}
          <path class="rev-glow" ref={glowEl} d={GLOW_TRACK} stroke="url(#spz-glow-w)" stroke-width={GLOW_W} pathLength={1} style={{ strokeDasharray: '0 1' }} />
          <path class="rev-fill" ref={fillEl} d={TRACK} stroke-width={TRACK_W} pathLength={1} style={{ strokeDasharray: '0 1' }} />
          <path class="red-glow" d={GLOW_RED} stroke="url(#spz-glow-r)" stroke-width={GLOW_W} />
          <path class="red-zone" d={RED_ZONE} stroke-width={TRACK_W} />
          <g class="ticks-major">
            {MAJOR_TICKS.map(t => (
              <line
                key={t.v}
                ref={el => { tickEls.current[t.v] = el }}
                x1={t.p1.x} y1={t.p1.y} x2={t.p2.x} y2={t.p2.y}
              />
            ))}
          </g>

          <g class="nums">
            {NUMS.map((p, i) => <text key={i} x={p.x} y={p.y}>{i}</text>)}
          </g>

          <g class="needle" ref={needleEl}>
            <polygon points={NEEDLE} fill="url(#spz-needle)" />
          </g>

          <g class="readout">
            <text class="t-rpm" x={CX} y={CY - 37}>RPM</text>
            <text class="t-rpmx" x={CX} y={CY - 30}>X1000</text>
            <text class="t-speed" ref={speedEl} x={CX} y={CY - 3}>0</text>
            <text class="t-unit" x={CX} y={CY + 15}>km/h</text>
            <text class="t-gear" key={String(d.gear)} x={CX} y={CY + 35}>{d.gear}</text>
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
