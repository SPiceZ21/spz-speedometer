import { useState, useEffect, useMemo } from 'preact/hooks'

const SEGMENTS = 40
const REDLINE = 32

interface SpeedoData {
  speed: number
  gear: number
  rpm: number
  maxRpm: number
}

const DEFAULT_DATA: SpeedoData = {
  speed: 0,
  gear: 1,
  rpm: 0,
  maxRpm: 1.0,
}

export function App() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<SpeedoData>(DEFAULT_DATA)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'update') setData(e.data)
      else if (e.data.type === 'show') setVisible(true)
      else if (e.data.type === 'hide') setVisible(false)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // 0..100 across the whole rev range, plus whether we are into the red.
  const rpmPct = useMemo(() => {
    const pct = (data.rpm / (data.maxRpm || 1)) * 100
    return Math.max(0, Math.min(100, isFinite(pct) ? pct : 0))
  }, [data.rpm, data.maxRpm])

  const redlinePct = (REDLINE / SEGMENTS) * 100
  const inRedline = rpmPct >= redlinePct

  if (!visible) return null

  const gearDisplay = data.gear === 0 ? 'R' : data.gear

  return (
    <div class="hud-wrap">
      <div class="speedo-container">
        {/* Rev counter as a continuous progress track, matching the checkpoint
            bar in the race HUD so the two read as the same instrument family. */}
        <div class="rpm-track" data-red={inRedline}>
          <div class="rpm-fill" style={{ width: `${rpmPct}%` }} />
          {/* Where the red starts — fixed marker, not part of the fill. */}
          <div class="rpm-redline" style={{ left: `${redlinePct}%` }} />
        </div>

        <div class="stats-row">
          <div class="gear-box">
            <span class="gear-val">{gearDisplay}</span>
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
