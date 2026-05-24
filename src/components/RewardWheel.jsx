import { useState, useEffect, useMemo, useRef } from 'react'
import { initializeApp, getApps } from 'firebase/app'
import { getDatabase, ref, get } from 'firebase/database'
import { FIREBASE_CONFIG } from '../constants'
import './RewardWheel.css'

const fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
const fbDb  = getDatabase(fbApp)

const SEG_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6',
  '#22c55e', '#eab308', '#f97316', '#ef4444',
  '#ec4899', '#a855f7', '#8b5cf6', '#06b6d4',
]

function pickWeightedRandom(entries) {
  const total = entries.reduce((s, [, r]) => s + (r.weight || 1), 0)
  let rand = Math.random() * total
  for (const [id, r] of entries) {
    rand -= (r.weight || 1)
    if (rand <= 0) return id
  }
  return entries[0][0]
}

// ── SVG Wheel ──────────────────────────────────────────────────────────────────

function WheelSVG({ segments, rotation, spinning, spinDuration }) {
  const CX = 150, CY = 150, R = 136

  return (
    <svg
      width="300" height="300"
      viewBox="0 0 300 300"
      style={{
        transform:       `rotate(${rotation}deg)`,
        transition:      spinning ? `transform ${spinDuration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : 'none',
        transformOrigin: '150px 150px',
        display:         'block',
      }}
    >
      <defs>
        <radialGradient id="rw-hub-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {segments.map((seg, i) => {
        const startRad = (seg.startAngle - 90) * (Math.PI / 180)
        const endRad   = (seg.endAngle   - 90) * (Math.PI / 180)
        const x1 = CX + R * Math.cos(startRad)
        const y1 = CY + R * Math.sin(startRad)
        const x2 = CX + R * Math.cos(endRad)
        const y2 = CY + R * Math.sin(endRad)
        const large   = (seg.endAngle - seg.startAngle) > 180 ? 1 : 0
        const midRad  = (seg.midAngle - 90) * (Math.PI / 180)
        const lr      = R * 0.65
        const lx      = CX + lr * Math.cos(midRad)
        const ly      = CY + lr * Math.sin(midRad)
        const segSpan = seg.endAngle - seg.startAngle
        const label   = seg.name.length > 12 ? seg.name.slice(0, 11) + '…' : seg.name
        const color   = SEG_COLORS[i % SEG_COLORS.length]

        // Inner lighter arc for depth
        const IR = R * 0.44
        const ix1 = CX + IR * Math.cos(startRad)
        const iy1 = CY + IR * Math.sin(startRad)
        const ix2 = CX + IR * Math.cos(endRad)
        const iy2 = CY + IR * Math.sin(endRad)

        return (
          <g key={seg.id}>
            <path
              d={`M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={color}
              stroke="rgba(0,0,0,0.30)"
              strokeWidth="1.5"
            />
            <path
              d={`M ${CX} ${CY} L ${ix1} ${iy1} A ${IR} ${IR} 0 ${large} 1 ${ix2} ${iy2} Z`}
              fill="rgba(255,255,255,0.06)"
              stroke="none"
            />
            {segSpan > 16 && (
              <text
                x={lx} y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${seg.midAngle}, ${lx}, ${ly})`}
                fontSize={seg.name.length > 9 ? '9' : '10.5'}
                fontWeight="700"
                fill="white"
                style={{
                  userSelect:  'none',
                  paintOrder:  'stroke',
                  stroke:      'rgba(0,0,0,0.65)',
                  strokeWidth: '3.5px',
                  fontFamily:  'system-ui, -apple-system, sans-serif',
                }}
              >
                {label}
              </text>
            )}
          </g>
        )
      })}

      {/* Outer ring */}
      <circle cx={CX} cy={CY} r={R}  fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
      {/* Shine overlay */}
      <circle cx={CX} cy={CY} r={R}  fill="url(#rw-hub-grad)" style={{ pointerEvents: 'none' }} />
      {/* Hub outer */}
      <circle cx={CX} cy={CY} r={19} fill="#0c0e1a" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      {/* Hub inner shine */}
      <circle cx={CX} cy={CY} r={10} fill="rgba(255,255,255,0.10)" />
      <circle cx={CX - 3} cy={CY - 3} r={3} fill="rgba(255,255,255,0.20)" />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function RewardWheel({ onClose }) {
  const [pool,     setPool]     = useState(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [done,     setDone]     = useState(false)
  const winnerRef  = useRef(null)

  const SPIN_DURATION = 5200

  useEffect(() => {
    get(ref(fbDb, 'challenge_pool'))
      .then(snap => setPool(snap.val() || {}))
      .catch(() => setPool({}))
  }, [])

  const { segments, winner } = useMemo(() => {
    if (!pool) return { segments: [], winner: null }
    const entries = Object.entries(pool)
    if (entries.length === 0) return { segments: [], winner: null }

    // Lock winner on first compute
    if (!winnerRef.current) winnerRef.current = pickWeightedRandom(entries)
    const winnerId = winnerRef.current

    const totalW = entries.reduce((s, [, r]) => s + (r.weight || 1), 0)
    let current  = 0
    const segs   = entries.map(([id, r]) => {
      const angle = ((r.weight || 1) / totalW) * 360
      const seg   = {
        id, name: r.name || id, description: r.description || '',
        startAngle: current,
        endAngle:   current + angle,
        midAngle:   current + angle / 2,
      }
      current += angle
      return seg
    })
    const win = segs.find(s => s.id === winnerId) || segs[0]
    return { segments: segs, winner: win }
  }, [pool])

  function spin() {
    if (spinning || done || !winner) return
    setSpinning(true)
    // Rotate so winner.midAngle ends up at 0° (top, where the pointer is)
    const toTop      = (360 - winner.midAngle % 360 + 360) % 360
    const finalAngle = 360 * 7 + toTop
    setRotation(finalAngle)
    setTimeout(() => { setSpinning(false); setDone(true) }, SPIN_DURATION + 200)
  }

  // Loading
  if (!pool) return (
    <div className="rw-overlay">
      <div className="rw-modal">
        <div className="rw-loading">
          <div className="rw-loading-spinner" />
          Chargement du pool…
        </div>
      </div>
    </div>
  )

  const entries = Object.entries(pool)

  // Empty pool
  if (entries.length === 0) return (
    <div className="rw-overlay" onClick={onClose}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>
        <p className="rw-empty">Aucune récompense dans le pool.<br />Ajoutes-en depuis l'interface admin !</p>
        <button className="rw-close-btn" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )

  return (
    <div className="rw-overlay" onClick={() => done && onClose()}>
      <div className="rw-modal" onClick={e => e.stopPropagation()}>

        <div className="rw-header">
          {!done ? (
            <>
              <p className="rw-eyebrow">Défi remporté !</p>
              <h3 className="rw-title">Quelle sera ta récompense ?</h3>
            </>
          ) : (
            <>
              <p className="rw-eyebrow rw-eyebrow--won">Félicitations !</p>
              <h3 className="rw-title rw-title--won">Tu as gagné</h3>
            </>
          )}
        </div>

        <div className="rw-wheel-wrap">
          <div className={`rw-glow-ring${done ? ' rw-glow-ring--won' : ''}`} />
          <div className="rw-pointer" />
          <WheelSVG
            segments={segments}
            rotation={rotation}
            spinning={spinning}
            spinDuration={SPIN_DURATION}
          />
        </div>

        <div className="rw-footer">
          {!done && !spinning && (
            <button className="rw-spin-btn" onClick={spin}>
              <span className="rw-spin-btn-icon">🎰</span>
              Tourner la roue
            </button>
          )}

          {spinning && (
            <p className="rw-hint rw-hint--spinning">
              <span className="rw-hint-dots"><span /><span /><span /></span>
              Bonne chance…
            </p>
          )}

          {done && winner && (
            <div className="rw-result">
              <div className="rw-result-name">{winner.name}</div>
              {winner.description && (
                <div className="rw-result-desc">{winner.description}</div>
              )}
              <button className="rw-close-btn rw-close-btn--won" onClick={onClose}>
                🎊 Super !
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
