import { useState } from 'react'

// ── Formatting ───────────────────────────────────────────────────────────────

function fmtCs(cs) {
  if (cs === null) return '—'
  if (cs === Infinity) return 'DNF'
  const rounded = Math.round(cs)
  if (rounded < 6000) {
    return (rounded / 100).toFixed(2) + 's'
  } else {
    const mins = Math.floor(rounded / 6000)
    const secs = Math.floor((rounded % 6000) / 100)
    const cents = rounded % 100
    return `${mins}:${String(secs).padStart(2, '0')}.${String(cents).padStart(2, '0')}`
  }
}

// ── Input parsing ────────────────────────────────────────────────────────────

function notationToCs(n) {
  if (n < 6000) return n
  const str = String(Math.round(n)).padStart(5, '0')
  const cents = parseInt(str.slice(-2), 10)
  const secs = parseInt(str.slice(-4, -2), 10)
  const mins = parseInt(str.slice(0, -4), 10)
  return mins * 6000 + secs * 100 + cents
}

function parseInput(raw) {
  const s = raw.trim()
  if (s === '') return { value: null, isDnf: false, warning: null }
  if (s.toUpperCase().startsWith('D') || s.startsWith('.')) return { value: Infinity, isDnf: true, warning: null }
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return { value: null, isDnf: false, warning: null }
  if (n >= 6000 && n <= 9999) {
    return { value: null, isDnf: false, warning: 'Invalid — for times over 1 min use 5-digit notation e.g. "10067" for 1:00.67' }
  }
  if (n >= 10000) {
    const str = String(Math.round(n)).padStart(5, '0')
    const secs = parseInt(str.slice(-4, -2), 10)
    if (secs >= 60) {
      return { value: null, isDnf: false, warning: `Invalid — seconds must be 00–59. e.g. "10593" for 1:05.93` }
    }
  }
  const realCs = notationToCs(n)
  return { value: realCs, isDnf: false, warning: null }
}

// ── Calculation helpers ──────────────────────────────────────────────────────

function countDnf(vals) {
  return vals.filter(v => v === Infinity).length
}

function timedOnly(vals) {
  return vals.filter(v => v !== null && v !== Infinity).sort((a, b) => a - b)
}

function calcAo5(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length < 5) return null
  if (countDnf(vals) >= 2) return Infinity
  const sorted = [...filled].sort((a, b) => a - b)
  return (sorted[1] + sorted[2] + sorted[3]) / 3
}

function calcWPA(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return null
  return calcAo5([...filled, Infinity])
}

function calcBPA(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return null
  const timed = timedOnly(filled)
  if (timed.length < 3) return Infinity
  return (timed[0] + timed[1] + timed[2]) / 3
}

function calcMinReq(vals, target) {
  if (target === null) return { val: null, msg: '' }
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return { val: null, msg: '' }

  const bpa = calcBPA(vals)
  const wpa = calcWPA(vals)

  if (wpa !== Infinity && wpa !== null && Math.round(wpa) <= target)
    return { val: 'anytime', msg: `Even a DNF on solve 5 beats target` }

  const dnfs = countDnf(filled)
  const timed = timedOnly(filled)
  if (bpa !== Infinity && bpa !== null && Math.round(bpa) <= target) {
    const worstCase = (timed[1] + timed[2] + timed[3]) / 3
    if (Math.round(worstCase) <= target)
      return { val: 'guaranteed', msg: `Target met regardless of solve 5` }
  }

  if (timed.length < 2) return { val: 'IMPOSSIBLE', msg: '' }

  const need = Math.ceil(3 * (target + 0.5) - timed[1] - timed[2]) - 1
  const worst = dnfs > 0 ? Infinity : timed[timed.length - 1]

  if (need > timed[0] && (dnfs > 0 || need < worst)) return { val: need, msg: '' }

  return { val: 'IMPOSSIBLE', msg: '' }
}

// ── Running average (shown in Ao5 box while < 5 solves) ─────────────────────
// 1 solve  → the solve itself
// 2 solves → avg of both
// 3 solves → middle value (drop best and worst)
// 4 solves → avg of middle 2 (drop best and worst)

function calcRunningAvg(vals) {
  const filled = vals.filter(v => v !== null)
  const n = filled.length
  if (n === 0) return null

  // DNF handling: treat DNF as Infinity in sort
  const sorted = [...filled].sort((a, b) => a - b)
  const dnfs = countDnf(filled)

  if (n === 1) return filled[0]
  if (n === 2) {
    if (dnfs >= 1) return Infinity
    return (sorted[0] + sorted[1]) / 2
  }
  if (n === 3) {
    // middle value = sorted[1]
    if (dnfs >= 2) return Infinity
    return sorted[1]
  }
  if (n === 4) {
    // avg of middle 2 = sorted[1] and sorted[2]
    if (dnfs >= 2) return Infinity
    if (sorted[1] === Infinity) return Infinity
    return (sorted[1] + sorted[2]) / 2
  }
  return null
}

// ── Helpers for tagging ──────────────────────────────────────────────────────

function droppedIndices(vals) {
  const filled = vals.map((v, i) => v !== null ? { v, i } : null).filter(Boolean)
  if (filled.length < 3) return { bestIdx: -1, worstIdx: -1 }
  const sorted = [...filled].sort((a, b) => a.v - b.v)
  return { bestIdx: sorted[0].i, worstIdx: sorted[sorted.length - 1].i }
}

function bestTimedIndex(vals) {
  const timed = vals.map((v, i) => (v !== null && v !== Infinity) ? { v, i } : null).filter(Boolean)
  if (timed.length === 0) return -1
  return timed.sort((a, b) => a.v - b.v)[0].i
}

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle = {
  background: '#ffffff',
  border: '1.5px solid #80cbc4',
  borderRadius: '8px',
  padding: '8px 12px',
  fontFamily: "'Inter', sans-serif",
  fontSize: '13px',
  color: '#222',
  width: '100%',
  outline: 'none',
  colorScheme: 'light',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#004d40',
  marginBottom: '6px',
}

const warnStyle = {
  fontSize: '11px',
  color: '#b71c1c',
  background: '#ffebee',
  border: '1px solid #ef9a9a',
  borderRadius: '6px',
  padding: '4px 8px',
  marginTop: '4px',
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Tag({ color, bg, children }) {
  return (
    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', flexShrink: 0, background: bg, color }}>
      {children}
    </span>
  )
}

function ResultBox({ label, sublabel, children }) {
  return (
    <div style={{ background: '#b2dfdb', border: '1.5px solid #80cbc4', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#004d40', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {label} <span style={{ fontSize: '9px', opacity: 0.7 }}>{sublabel}</span>
      </div>
      <div style={{ fontSize: '18px', fontWeight: 700, color: '#00695c' }}>{children}</div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function App() {
  const [attempts, setAttempts] = useState(['', '', '', '', ''])
  const [targetRaw, setTargetRaw] = useState('')

  const parsed = attempts.map(a => parseInput(a))
  const vals = parsed.map(p => p.value)

  const targetParsed = parseInput(targetRaw)
  const target = (targetParsed.value === null || targetParsed.value === Infinity) ? null : targetParsed.value

  const filled = vals.filter(v => v !== null)
  const progress = filled.length / 5

  const ao5 = calcAo5(vals)
  const wpa = filled.length === 4 ? calcWPA(vals) : null
  const bpa = filled.length === 4 ? calcBPA(vals) : null
  const minr = calcMinReq(vals, target)
  const runningAvg = filled.length < 5 ? calcRunningAvg(vals) : null

  // Dropped indices — for 3+ solves show best/worst tags
  const { bestIdx, worstIdx } = filled.length >= 3 ? droppedIndices(vals) : { bestIdx: -1, worstIdx: -1 }
  const bestTimed4 = filled.length === 4 ? bestTimedIndex(vals) : -1

  // For 5 solves, re-compute dropped from ao5 perspective
  const { bestIdx: best5, worstIdx: worst5 } = filled.length === 5 ? droppedIndices(vals) : { bestIdx: -1, worstIdx: -1 }

  const ao5Beats = ao5 !== null && ao5 !== Infinity && target !== null && Math.round(ao5) <= target
  const ao5IsDnf = ao5 === Infinity

  // Running avg pace
  const runningBeats = runningAvg !== null && runningAvg !== Infinity && target !== null && Math.round(runningAvg) <= target
  const runningIsDnf = runningAvg === Infinity

  const updateAttempt = (i, val) => {
    setAttempts(prev => { const next = [...prev]; next[i] = val; return next })
  }

  const clearAll = () => {
    setAttempts(['', '', '', '', ''])
    setTargetRaw('')
  }

  // Ao5 box display value
  const ao5DisplayVal = filled.length === 5
    ? (ao5 === null ? '—' : ao5IsDnf ? 'DNF' : fmtCs(Math.round(ao5)))
    : (runningAvg === null ? '—' : runningIsDnf ? 'DNF' : fmtCs(Math.round(runningAvg)))

  const showPace = filled.length < 5 && runningAvg !== null && target !== null

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* Header */}
      <div style={{ background: '#00695c', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>Ao5 Calculator</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', letterSpacing: '0.1em', marginTop: '2px' }}>WCA LIVE · SPECTATOR MODE</div>
        </div>
        <a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 10px' }}>
          <img src="https://assets.worldcubeassociation.org/assets/0e752e6/assets/WCA Logo-4ef000323c6a9a407cdf07647a31c0ef4dc847f2352a9a136ef3e809e95bdeab.svg" alt="WCA" style={{ height: '28px', width: 'auto' }} onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
          <span style={{ display: 'none', color: '#fff', fontSize: '11px', fontWeight: 700 }}>WCA</span>
        </a>
      </div>

      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '0 16px' }}>

        {/* Target — two row layout */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ background: '#fff', border: '1.5px solid #80cbc4', borderRadius: '8px', padding: '8px 12px', marginBottom: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00695c', marginBottom: '4px' }}>Target</div>
            <input
              type="text"
              inputMode="decimal"
              value={targetRaw}
              onChange={e => setTargetRaw(e.target.value)}
              placeholder='e.g. key in 178 for 1.78s, 10067 for 1:00.67, "." or "D" for DNF'
              style={{ ...inputStyle, border: 'none', padding: '0', fontSize: '14px', fontWeight: 600 }}
            />
          </div>
          {targetParsed.warning && <div style={warnStyle}>{targetParsed.warning}</div>}

        </div>

        {/* Progress bar */}
        <div style={{ height: '3px', background: '#e0f2f1', borderRadius: '2px', margin: '10px 0', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#00695c', borderRadius: '2px', width: `${progress * 100}%`, transition: 'width 0.3s' }} />
        </div>

        {/* Attempts */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>Attempts</div>
          {attempts.map((raw, i) => {
            const p = parsed[i]
            const isDnf = p.isDnf
            const n = filled.length

            // Determine best/worst tags based on solve count
            let showBest = false, showWorst = false
            if (n === 5) {
              showBest = best5 === i && !isDnf
              showWorst = worst5 === i && !isDnf
            } else if (n >= 3) {
              showBest = bestIdx === i && !isDnf
              showWorst = worstIdx === i && !isDnf
            }

            const isPending = p.value === null && !isDnf && i >= n
            const isDnfRow = isDnf
            const isDropped = showBest || showWorst

            const rowBg = isDnfRow ? '#ffcdd2' : '#b2dfdb'
            const rowBorder = isDnfRow ? '#ef9a9a' : (showWorst ? '#ef9a9a' : '#80cbc4')
            const numColor = isDnfRow ? '#c62828' : showBest || showWorst ? '#c62828' : '#00796b'

            return (
              <div key={i} style={{ marginBottom: '5px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: rowBg, border: `1.5px solid ${rowBorder}`,
                  borderRadius: '8px', padding: '5px 10px',
                  opacity: isPending ? 0.4 : 1, transition: 'all 0.2s'
                }}>
                  <span style={{ fontSize: '10px', color: numColor, width: '14px', flexShrink: 0, fontWeight: 600 }}>{i + 1}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={raw}
                    onChange={e => updateAttempt(i, e.target.value)}
                    placeholder={isPending ? '—' : ''}
                    style={{ ...inputStyle, margin: 0, flex: 1, fontSize: isDnf ? '13px' : '14px', fontWeight: isDnf ? 700 : 400, color: isDnf ? '#c62828' : '#222', padding: '4px 8px', minWidth: 0, border: 'none' }}
                  />
                  {showBest && <Tag color="#00695c" bg="#e0f2f1">best</Tag>}
                  {showWorst && <Tag color="#c62828" bg="#ffebee">worst</Tag>}
                  {isDnf && <Tag color="#fff" bg="#c62828">DNF</Tag>}
                </div>
                {p.warning && <div style={warnStyle}>{p.warning}</div>}
              </div>
            )
          })}
        </div>

        {/* Ao5 box */}
        <div style={{
          background: ao5IsDnf ? '#b71c1c' : '#00695c',
          borderRadius: '10px', padding: '12px 14px', marginBottom: '8px'
        }}>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Ao5</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ color: '#fff', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>
              {ao5DisplayVal}
            </div>
            {/* TARGET badge — 5 solves */}
            {ao5Beats && (
              <div style={{ background: '#43a047', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', letterSpacing: '0.05em' }}>TARGET</div>
            )}
            {/* Pace indicator — < 5 solves */}
            {showPace && !runningIsDnf && (
              <div style={{
                fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '4px',
                background: runningBeats ? 'rgba(76,175,80,0.25)' : 'rgba(244,67,54,0.2)',
                color: runningBeats ? '#a5d6a7' : '#ef9a9a'
              }}>
                {runningBeats ? 'on target pace' : 'off target pace'}
              </div>
            )}
          </div>
        </div>

        {/* WPA / BPA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <ResultBox label="WPA" sublabel="worst possible">
            {wpa === null ? '—' : wpa === Infinity ? <span style={{ color: '#c62828', fontSize: '16px', fontWeight: 700 }}>DNF</span> : fmtCs(Math.round(wpa))}
          </ResultBox>
          <ResultBox label="BPA" sublabel="best possible">
            {bpa === null ? '—' : bpa === Infinity ? <span style={{ color: '#c62828', fontSize: '16px', fontWeight: 700 }}>DNF</span> : fmtCs(Math.round(bpa))}
          </ResultBox>
        </div>

        {/* Min required */}
        <div style={{
          background: minr.val === 'IMPOSSIBLE' ? '#ffebee' : '#b2dfdb',
          border: `1.5px solid ${minr.val === 'IMPOSSIBLE' ? '#ef9a9a' : '#80cbc4'}`,
          borderRadius: '10px', padding: '10px 14px', marginBottom: '12px'
        }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: minr.val === 'IMPOSSIBLE' ? '#b71c1c' : '#004d40', marginBottom: '4px' }}>
            Minimum required for target
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: minr.val === 'IMPOSSIBLE' ? '#b71c1c' : minr.val === 'guaranteed' || minr.val === 'anytime' ? '#00695c' : '#004d40' }}>
            {minr.val === null && '—'}
            {minr.val === 'IMPOSSIBLE' && 'IMPOSSIBLE'}
            {minr.val === 'guaranteed' && 'Already guaranteed'}
            {minr.val === 'anytime' && 'Any time works'}
            {typeof minr.val === 'number' && `${fmtCs(minr.val)} or better`}
          </div>
          {minr.msg && <div style={{ fontSize: '11px', color: '#00695c', marginTop: '2px' }}>{minr.msg}</div>}
        </div>

        {/* Clear */}
        <button onClick={clearAll} style={{
          width: '100%', padding: '12px', backgroundColor: '#ff7043', border: 'none',
          borderRadius: '8px', color: '#fff', fontFamily: "'Inter', sans-serif",
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.03em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
          </svg>
          Clear All Values
        </button>

        <div style={{ textAlign: 'center', fontSize: '10px', color: '#80cbc4', marginTop: '16px', letterSpacing: '0.05em' }}>
          Ao5 Calculator · by tankuoping@gmail.com
          <br />
          Chief tester: Jovan Susanto
        </div>
      </div>
    </div>
  )
}
