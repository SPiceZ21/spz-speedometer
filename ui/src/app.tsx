import { useState, useEffect, useMemo } from 'preact/hooks'
import { 
  ChevronLeft, 
  ChevronRight, 
  Lightbulb, 
  Activity, 
  Lock, 
  ParkingCircle 
} from 'lucide-preact'

const SEGMENTS = 40
const REDLINE = 32

interface SpeedoData {
  speed: number
  gear: number
  rpm: number
  maxRpm: number
  status: {
    leftBlinker: boolean;
    rightBlinker: boolean;
    lights: boolean;
    highbeams: boolean;
    engine: boolean;
    handbrake: boolean;
    locked: boolean;
  }
  nos?: { hasNitro: boolean; level: number }
}

const DEFAULT_DATA: SpeedoData = {
  speed: 0,
  gear: 1,
  rpm: 0,
  maxRpm: 1.0,
  status: {
    leftBlinker: false,
    rightBlinker: false,
    lights: false,
    highbeams: false,
    engine: false,
    handbrake: false,
    locked: false
  },
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
          <div class="dash-indicators">
            <ChevronLeft 
              size={20} 
              class={`ind-icon ${data.status.leftBlinker ? 'active-green' : 'inactive'}`} 
            />
            <Lightbulb 
              size={18} 
              class={`ind-icon ${data.status.highbeams ? 'active-blue' : data.status.lights ? 'active-green' : 'inactive'}`} 
            />
            <ParkingCircle 
              size={18} 
              class={`ind-icon ${data.status.handbrake ? 'active-red' : 'inactive'}`} 
            />
            <Activity 
              size={18} 
              class={`ind-icon ${data.status.engine ? 'active-amber' : 'inactive'}`} 
            />
            <Lock 
              size={16} 
              class={`ind-icon ${data.status.locked ? 'active-white' : 'inactive'}`} 
            />
            <ChevronRight 
              size={20} 
              class={`ind-icon ${data.status.rightBlinker ? 'active-green' : 'inactive'}`} 
            />
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
