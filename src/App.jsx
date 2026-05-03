import { useState } from 'react'

// ── Formatting ───────────────────────────────────────────────────────────────

// cs is always REAL centiseconds (6000cs = 1 min)
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

// Convert user notation to REAL centiseconds:
// < 6000  → raw cs (178 = 1.78s)
// >= 10000 → MSSCS notation: 10067 → 1:00.67 → 6067cs, 11523 → 1:15.23 → 7523cs
// 6000–9999 → invalid, warn
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
  if (s.toUpperCase().startsWith('D')) return { value: Infinity, isDnf: true, warning: null }
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return { value: null, isDnf: false, warning: null }
  if (n >= 6000 && n <= 9999) {
    return { value: null, isDnf: false, warning: 'Invalid — for times over 1 min use 5-digit notation e.g. "10067" for 1:00.67' }
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

// Ao5: drop best and worst, average middle 3. 2+ DNFs = DNF
function calcAo5(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length < 5) return null
  if (countDnf(vals) >= 2) return Infinity
  const sorted = [...filled].sort((a, b) => a - b)
  return (sorted[1] + sorted[2] + sorted[3]) / 3
}

// WPA: worst case = solve 5 is DNF
function calcWPA(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return null
  return calcAo5([...filled, Infinity])
}

// BPA: best case = solve 5 is as fast as or faster than current best timed
// → solve 5 dropped as best, DNF (if any) dropped as worst
// → avg of 2nd, 3rd, 4th best timed of the 4 known solves
function calcBPA(vals) {
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return null
  const timed = timedOnly(filled)
  if (timed.length < 3) return Infinity
  return (timed[0] + timed[1] + timed[2]) / 3
}

// Min required: drop DNF/worst, drop best timed, X in middle
// avg(X + timed[1] + timed[2]) / 3 <= target → X <= 3*target - timed[1] - timed[2]
function calcMinReq(vals, target) {
  if (target === null) return { val: null, msg: '' }
  const filled = vals.filter(v => v !== null)
  if (filled.length !== 4) return { val: null, msg: '' }

  const bpa = calcBPA(vals)
  const wpa = calcWPA(vals)

  // "Any time works" = even DNF on solve 5 (WPA) still beats target
  if (wpa !== Infinity && wpa !== null && Math.round(wpa) <= target)
    return { val: 'anytime', msg: `Even a DNF on solve 5 beats target` }

  // "Already guaranteed" = even if solve 5 is the new worst (just above current worst),
  // Ao5 still beats target. This means avg(timed[0]+timed[1]+timed[2])/3 = BPA <= target
  // AND we need solve 5 to be droppable as worst, so solve 5 must be >= timed[3].
  // For any solve 5 >= timed[3]: dropped as worst, Ao5 = BPA <= target ✅
  // For any solve 5 < timed[3]: lands in middle or best → Ao5 even better ✅
  // So BPA <= target truly means guaranteed for ALL possible solve 5 values!
  // Edge case: if solve 5 = timed[3] exactly, both are tied for worst → one dropped, other in middle
  // → avg(timed[0]+timed[1]+timed[3])/3 which could be > BPA. So need to check this too.
  const dnfs = countDnf(filled)
  const timed = timedOnly(filled)
  if (bpa !== Infinity && bpa !== null && Math.round(bpa) <= target) {
    // Check worst case within "guaranteed": solve 5 = timed[3] (tied worst)
    // Sort: timed[0], timed[1], timed[2], timed[3], timed[3] → drop timed[0], drop one timed[3]
    // Ao5 = (timed[1] + timed[2] + timed[3]) / 3
    const worstCase = (timed[1] + timed[2] + timed[3]) / 3
    if (Math.round(worstCase) <= target)
      return { val: 'guaranteed', msg: `Target met regardless of solve 5` }
  }

  if (timed.length < 2) return { val: 'IMPOSSIBLE', msg: '' }

  // X must land in middle: drop timed[0] as best, drop worst/DNF
  // avg(X + timed[1] + timed[2]) / 3 <= target → X <= 3*target - timed[1] - timed[2]
  const need = Math.round(3 * target - timed[1] - timed[2])
  const worst = dnfs > 0 ? Infinity : timed[timed.length - 1]

  // need must be > timed[0] (if not, X would be dropped as best → that is BPA case, already IMPOSSIBLE)
  // need must be < worst (if X >= worst, X gets dropped as worst → avg = timed[0]+timed[1]+timed[2] = BPA, already checked)
  if (need > timed[0] && (dnfs > 0 || need < worst)) return { val: need, msg: '' }

  return { val: 'IMPOSSIBLE', msg: '' }
}

// ── Helpers for tagging ──────────────────────────────────────────────────────

function droppedIndices(vals) {
  const filled = vals.map((v, i) => v !== null ? { v, i } : null).filter(Boolean)
  if (filled.length < 5) return { bestIdx: -1, worstIdx: -1 }
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

const hintStyle = {
  fontSize: '11px',
  color: '#00695c',
  marginTop: '3px',
  paddingLeft: '4px',
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

const PLACEHOLDER = '"178" for 1.78s, "10067" for 1:00.67 or "D" for DNF'

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

  const { bestIdx, worstIdx } = filled.length === 5 ? droppedIndices(vals) : { bestIdx: -1, worstIdx: -1 }
  const bestTimed4 = filled.length === 4 ? bestTimedIndex(vals) : -1

  const ao5Beats = ao5 !== null && ao5 !== Infinity && target !== null && Math.round(ao5) <= target
  const ao5IsDnf = ao5 === Infinity

  const updateAttempt = (i, val) => {
    setAttempts(prev => { const next = [...prev]; next[i] = val; return next })
  }

  const clearAll = () => {
    setAttempts(['', '', '', '', ''])
    setTargetRaw('')
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', padding: '0 0 40px' }}>

      {/* Header */}
      <div style={{ background: '#00695c', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>Ao5 Calculator</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', letterSpacing: '0.1em', marginTop: '2px' }}>WCA LIVE · SPECTATOR MODE</div>
        </div>
        <a href="https://www.worldcubeassociation.org" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '6px 10px' }}>
          <img src="https://assets.worldcubeassociation.org/assets/0e752e6/assets/WCA Logo-4ef000323c6a9a407cdf07647a31c0ef4dc847f2352a9a136ef3e809e95bdeab.svg" alt="WCA" style={{ height: '28px', width: 'auto' }} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block' }} />
          <span style={{ display: 'none', color: '#fff', fontSize: '11px', fontWeight: 700 }}>WCA</span>
        </a>
      </div>

      <div style={{ maxWidth: '460px', margin: '0 auto', padding: '0 16px' }}>

        {/* Target */}
        <div style={{ marginBottom: '8px' }}>
          <div style={labelStyle}>Target</div>
          <input type="text" value={targetRaw} onChange={e => setTargetRaw(e.target.value)} placeholder={PLACEHOLDER} style={inputStyle} />
          {targetParsed.warning && <div style={warnStyle}>{targetParsed.warning}</div>}

        </div>

        {/* Progress bar */}
        <div style={{ height: '3px', background: '#80cbc4', borderRadius: '2px', margin: '10px 0', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#00695c', borderRadius: '2px', width: `${progress * 100}%`, transition: 'width 0.3s' }} />
        </div>

        {/* Attempts */}
        <div style={{ marginBottom: '12px' }}>
          <div style={labelStyle}>Attempts</div>
          {attempts.map((raw, i) => {
            const p = parsed[i]
            const isDnf = p.isDnf
            const hasDnfInFilled = countDnf(vals.filter(v => v !== null)) > 0

            // Tags for 5 solves
            const isBest5 = bestIdx === i && !isDnf
            const isWorst5 = worstIdx === i && !isDnf

            // Tags for 4 solves: only show "best" on best timed; DNF row just shows DNF tag (no "worst")
            const isBest4 = bestTimed4 === i && filled.length === 4 && !isDnf

            const isPending = p.value === null && !isDnf && i >= filled.length

            const rowBg = isDnf ? '#ffcdd2' : '#b2dfdb'
            const rowBorder = isDnf ? '#ef9a9a' : (isWorst5 ? '#ef9a9a' : '#80cbc4')
            const numColor = isDnf ? '#c62828' : '#00796b'

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
                    value={raw}
                    onChange={e => updateAttempt(i, e.target.value)}
                    placeholder={isPending ? '—' : PLACEHOLDER}
                    style={{ ...inputStyle, margin: 0, flex: 1, fontSize: isDnf ? '13px' : '14px', fontWeight: isDnf ? 700 : 400, color: isDnf ? '#c62828' : '#222', padding: '4px 8px', minWidth: 0 }}
                  />
                  {isBest5 && <Tag color="#00695c" bg="#e0f2f1">best</Tag>}
                  {isWorst5 && <Tag color="#c62828" bg="#ffebee">worst</Tag>}
                  {isBest4 && <Tag color="#00695c" bg="#e0f2f1">best</Tag>}
                  {isDnf && <Tag color="#fff" bg="#c62828">DNF</Tag>}
                </div>
                {p.warning && <div style={warnStyle}>{p.warning}</div>}

              </div>
            )
          })}
        </div>

        {/* Results */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div style={{ gridColumn: '1/-1', background: ao5IsDnf ? '#b71c1c' : '#00695c', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Ao5</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ color: '#fff', fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>
                {ao5 === null ? '—' : ao5IsDnf ? 'DNF' : fmtCs(Math.round(ao5))}
              </div>
              {ao5Beats && <div style={{ background: '#43a047', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', letterSpacing: '0.05em' }}>TARGET</div>}
            </div>
          </div>

          <ResultBox label="WPA" sublabel="worst possible">
            {wpa === null ? '—' : wpa === Infinity ? <span style={{ color: '#c62828', fontSize: '16px', fontWeight: 700 }}>DNF</span> : fmtCs(wpa)}
          </ResultBox>

          <ResultBox label="BPA" sublabel="best possible">
            {bpa === null ? '—' : bpa === Infinity ? <span style={{ color: '#c62828', fontSize: '16px', fontWeight: 700 }}>DNF</span> : fmtCs(bpa)}
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

        <div style={{ textAlign: 'center', fontSize: '10px', color: '#00796b', marginTop: '16px', letterSpacing: '0.05em' }}>
          Ao5 Calculator · by tankuoping@gmail.com
        </div>
      </div>
    </div>
  )
}
