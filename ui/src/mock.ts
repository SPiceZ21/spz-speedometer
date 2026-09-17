/*
 * Dev harness for the speedometer.
 *
 * DEV-only — `import.meta.env.DEV` is a compile-time constant, so `vite build`
 * folds it to false and drops this whole module. Same pattern as
 * spz-spawn/ui/src/mock.ts.
 *
 * It exists because none of the motion on this dial can be judged from a still
 * frame, and the only other way to see it is to sit in a car in FiveM and
 * drive. The needle spring, the ignition sweep and the shift lights all have to
 * be watched RUNNING and tuned against something that behaves like an engine,
 * so this drives the same messages Lua sends, off a small engine model.
 *
 *   spz.drive()        engine model on a loop — the one to leave running
 *   spz.stop()         stop it
 *   spz.show()         replay the ignition sweep
 *   spz.hide()
 *   spz.rev(0..100)    hold a rev band
 *   spz.speed(kmh)
 *   spz.gear(n)
 *   spz.boost(0..1)
 *   spz.scene(name)    one-shot states, see SCENES below
 */

type Status = {
  leftBlinker?: boolean
  rightBlinker?: boolean
  lights?: boolean
  highbeams?: boolean
  handbrake?: boolean
}

type Frame = {
  speed: number
  gear: number | string
  pct: number
  inRedline: boolean
  shifting: boolean
  limiter: boolean
  launch: boolean
  tcsCut: boolean
  boost: number
  rewindMax: number
  rewindLeft: number
  status: Status
}

const send = (data: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { data }))

const base = (): Frame => ({
  speed: 0,
  gear: 1,
  pct: 0,
  inRedline: false,
  shifting: false,
  limiter: false,
  launch: false,
  tcsCut: false,
  boost: 0,
  rewindMax: 20000,
  rewindLeft: 13000,
  status: {},
})

let frame: Frame = base()
const push = (patch: Partial<Frame> = {}) => {
  frame = { ...frame, ...patch }
  send({ type: 'update', ...frame })
}

/*
 * The engine model.
 *
 * Deliberately crude — it only has to produce the SHAPE the easing has to cope
 * with: revs climbing under load, a hard drop on the upshift, a hang on the
 * limiter, and an overrun back to idle off throttle. A more accurate model
 * would not make the needle any easier to tune.
 */
const IDLE = 12          // % of the band at idle
const SHIFT_AT = 92      // upshift here
const DROP_TO = 55       // revs land here in the next gear
const TOP_GEAR = 6

let timer: number | null = null

function drive() {
  stop()
  let pct = IDLE
  let gear = 1
  let speed = 0
  let shifting = 0       // frames of shift cut left
  let throttle = 1
  let hold = 0           // frames to sit at the limiter before shifting

  // 20 Hz, the same rate client/main.lua pushes at. Tuning against a faster
  // feed would flatter the easing and hide exactly the stepping it is there
  // to fix.
  timer = window.setInterval(() => {
    if (shifting > 0) {
      shifting--
      if (shifting === 0) pct = DROP_TO
    } else if (throttle > 0) {
      // Higher gears pull more slowly, which is what makes the sweep of the
      // needle vary rather than being the same ramp six times.
      pct += (2.6 - gear * 0.28) * throttle
      if (pct >= SHIFT_AT) {
        if (gear < TOP_GEAR) {
          if (hold++ > 4) { hold = 0; gear++; shifting = 3 }
          pct = Math.min(100, pct)
        } else {
          pct = 97 + Math.sin(Date.now() / 40) * 2   // bounce off the limiter
        }
      }
    } else {
      pct = Math.max(IDLE, pct - 3)
    }

    speed = Math.round(gear * 32 + (pct / 100) * 30)

    // Let it run to top gear, sit there a moment, then lift and come back.
    if (gear === TOP_GEAR && pct > 95) throttle = 0
    if (throttle === 0 && pct <= IDLE + 1) { gear = 1; throttle = 1; pct = IDLE }

    push({
      pct,
      gear,
      speed,
      shifting: shifting > 0,
      inRedline: pct >= 88,
      limiter: gear === TOP_GEAR && pct > 95,
      // Spool follows load, and bleeds off the moment the throttle closes.
      boost: throttle > 0 ? Math.min(1, Math.max(0, (pct - 30) / 60)) : 0,
    })
  }, 50)
}

function stop() {
  if (timer !== null) { clearInterval(timer); timer = null }
}

const SCENES: Record<string, () => void> = {
  idle:     () => { stop(); push({ ...base(), pct: IDLE, speed: 0, gear: 1 }) },
  pullaway: () => { stop(); push({ pct: 60, speed: 48, gear: 2, boost: 0.5 }) },
  redline:  () => { stop(); push({ pct: 94, speed: 210, gear: 5, inRedline: true, boost: 0.95 }) },
  limiter:  () => { stop(); push({ pct: 99, speed: 246, gear: 6, inRedline: true, limiter: true, boost: 1 }) },
  shift:    () => {
    // The overshoot case: hard upshift, revs collapse, needle should bounce.
    stop()
    push({ pct: SHIFT_AT, speed: 150, gear: 3, boost: 0.9 })
    setTimeout(() => push({ pct: SHIFT_AT, gear: 4, shifting: true }), 300)
    setTimeout(() => push({ pct: DROP_TO, gear: 4, shifting: false }), 450)
  },
  launch:   () => { stop(); push({ pct: 70, speed: 0, gear: 1, launch: true, boost: 0.8 }) },
  tcs:      () => { stop(); push({ pct: 80, speed: 60, gear: 2, tcsCut: true, boost: 0.7 }) },
  na:       () => { stop(); push({ pct: 55, speed: 90, gear: 3, boost: 0 }) },  // no turbo: no boost arc
  lights:   () => { stop(); push({ status: { lights: true, highbeams: true, leftBlinker: true, handbrake: true } }) },

  // The skip-the-sweep path: show arrives while the car is already at speed.
  'moving-entry': () => {
    stop()
    send({ type: 'hide' })
    setTimeout(() => {
      send({ type: 'show' })
      push({ pct: 70, speed: 180, gear: 5, boost: 0.8 })
    }, 250)
  },
}

export const initMockEnv = () => {
  if (!import.meta.env.DEV) return

  ;(window as any).GetParentResourceName ??= () => 'spz-speedometer'
  ;(window as any).spz = {
    show:  () => { send({ type: 'show' }); push() },
    hide:  () => { stop(); send({ type: 'hide' }) },
    rev:   (p: number) => push({ pct: Math.max(0, Math.min(100, p)) }),
    speed: (v: number) => push({ speed: Math.round(v) }),
    gear:  (g: number | string) => push({ gear: g }),
    boost: (b: number) => push({ boost: Math.max(0, Math.min(1, b)) }),
    status: (s: Status) => push({ status: s }),
    scene: (name: string) => (SCENES[name] ?? SCENES.idle)(),
    scenes: () => Object.keys(SCENES),
    drive,
    stop,
    send,
  }

  console.log('[mock] spz.drive() · spz.show() · spz.scene(…) ·', Object.keys(SCENES).join(' '))

  /*
   * Boot into the state a driver actually sees first: cluster comes up, sweep
   * runs, engine idles.
   *
   * DEFERRED, and it has to be. main.tsx calls this before `render`, and even
   * if it did not, Preact defers useEffect to after paint — so a message sent
   * now lands before App has subscribed to `message` and is simply dropped.
   * Two frames puts it safely after the effect flush.
   */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    send({ type: 'show' })
    push({ pct: IDLE })
  }))
}
