import { useState, useEffect, useMemo } from 'preact/hooks'

const SEGMENTS = 40
const REDLINE = 32

interface SpeedoData {
  speed: number
  gear: number
  rpm: number
  maxRpm: number
  assists: { tcs: boolean; abs: boolean; esc: boolean }
  nos?: { hasNitro: boolean; level: number }
}

const DEFAULT_DATA: SpeedoData = {
  speed: 0,
  gear: 1,
  rpm: 0,
  maxRpm: 8000,
  assists: { tcs: false, abs: false, esc: false },
  nos: { hasNitro: false, level: 0 },
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

  const activeSegments = useMemo(() => {
    const pct = data.rpm / (data.maxRpm || 8000)
    return Math.floor(pct * SEGMENTS)
  }, [data.rpm, data.maxRpm])

  if (!visible) return null

  const gearDisplay = data.gear === 0 ? 'R' : data.gear

  return (
    <div class="hud-wrap">
      <div class="speedo-container">
        <div class="rpm-bar">
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <div
              key={i}
              class="rpm-seg"
              data-active={i < activeSegments}
              data-current={i === activeSegments && activeSegments < SEGMENTS}
              data-redline={i >= REDLINE}
            />
          ))}
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

        <div class="bottom-row">
          <div class="ind-group">
            <span class="ind-chip" data-active={data.assists.abs}>ABS</span>
            <span class="ind-chip" data-active={data.assists.tcs}>TCS</span>
            <span class="ind-chip" data-active={data.assists.esc}>ESC</span>
          </div>
          {data.nos?.hasNitro && (
            <div class="nos-mini-wrap">
              <span class="nos-label">NOS</span>
              <div class="nos-bar">
                <div class="nos-fill" style={{ width: `${data.nos.level}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
