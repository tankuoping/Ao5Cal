import { useState, useCallback } from 'react'
import styles from './App.module.css'

// ── Calculation helpers ──────────────────────────────────────────────────────

function calcAo5(vals) {
  const pos = vals.filter(v => v !== null)
  if (pos.length < 5) return null
  const s = [...pos].sort((a, b) => a - b)
  return (s[1] + s[2] + s[3]) / 3
}

function calcWPA(vals) {
  const pos = vals.filter(v => v !== null)
  if (pos.length !== 4) return null
  const s = [...pos].sort((a, b) => a - b)
  // Worst possible: 5th is DNF/very slow → dropped as worst, avg top 3 of remaining 4
  return (s[1] + s[2] + s[3]) / 3
}

function calcBPA(vals) {
  const pos = vals.filter(v => v !== null)
  if (pos.length !== 4) return null
  const s = [...pos].sort((a, b) => a - b)
  // Best possible: 5th is perfect → dropped as best, drop worst of 4, avg remaining 3
  return (s[0] + s[1] + s[2]) / 3
}

function calcMinReq(vals, target) {
  if (target === null) return { val: null, msg: '' }
  const pos = vals.filter(v => v !== null)
  if (pos.length !== 4) return { val: null, msg: pos.length === 3 ? 'Enter solve 4 first' : '' }

  const s = [...pos].sort((a, b) => a - b)
  const wpa = calcWPA(vals)
  const bpa = calcBPA(vals)

  if (bpa !== null && bpa <= target)
    return { val: 'Already guaranteed', msg: `BPA ${(bpa / 100).toFixed(2)}s beats target`, guaranteed: true }
  if (wpa !== null && wpa <= target)
    return { val: 'Any time works', msg: `Even worst-case (WPA ${(wpa / 100).toFixed(2)}s) beats target`, guaranteed: true }

  // Find x such that Ao5(s0,s1,s2,s3,x) <= target
  // When s[0] < x <= s[3]: drop s[0] and s[3], ao5 = (x + s[1] + s[2]) / 3
  const needB = 3 * target - s[1] - s[2]
  if (needB > 0 && needB <= s[3])
    return { val: needB, msg: `≤ ${(needB / 100).toFixed(2)}s on solve 5` }

  return { val: 'IMPOSSIBLE', msg: 'Even a perfect solve cannot save it' }
}

function fmt(cs) {
  return cs === null ? '—' : (cs / 100).toFixed(2) + 's'
}

// ── Component ────────────────────────────────────────────────────────────────

export default function App() {
  const [attempts, setAttempts] = useState(['', '', '', '', ''])
  const [targetStr, setTargetStr] = useState('')

  const vals = attempts.map(a => {
    const v = parseFloat(a)
    return !isNaN(v) && v > 0 ? v : null
  })
  const target = (() => { const v = parseFloat(targetStr); return !isNaN(v) && v > 0 ? v : null })()
  const pos = vals.filter(v => v !== null)

  const ao5 = calcAo5(vals)
  const wpa = calcWPA(vals)
  const bpa = calcBPA(vals)
  const minr = calcMinReq(vals, target)

  // Which solves get dropped in Ao5
  const droppedIdxs = (() => {
    if (ao5 === null) return []
    const posI = vals.map((v, i) => v !== null ? { v, i } : null).filter(Boolean)
    const sorted = [...posI].sort((a, b) => a.v - b.v)
    return [sorted[0].i, sorted[sorted.length - 1].i]
  })()

  const updateAttempt = useCallback((i, val) => {
    setAttempts(prev => { const next = [...prev]; next[i] = val; return next })
  }, [])

  const clearAll = () => {
    setAttempts(['', '', '', '', ''])
    setTargetStr('')
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1>Ao5 Calculator</h1>
        <p>WCA LIVE · SPECTATOR MODE</p>
      </header>

      {/* Target input */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>NR / PR / Target (centiseconds)</div>
        <div className={styles.nrRow}>
          <label>Target</label>
          <input
            type="number"
            value={targetStr}
            onChange={e => setTargetStr(e.target.value)}
            placeholder="e.g. 224"
            min="0"
          />
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${pos.length / 5 * 100}%` }} />
      </div>

      {/* Attempts */}
      <div className={styles.card}>
        <div className={styles.cardLabel}>Attempts (centiseconds)</div>
        <div className={styles.attemptsGrid}>
          {attempts.map((val, i) => {
            const isDropped = droppedIdxs.includes(i)
            const isPending = i >= pos.length && ao5 === null
            const isBest = ao5 !== null && droppedIdxs[0] === i
            const isWorst = ao5 !== null && droppedIdxs[1] === i
            return (
              <div
                key={i}
                className={[
                  styles.attemptRow,
                  isDropped ? styles.dropped : '',
                  isPending && i > pos.length ? styles.pending : '',
                ].join(' ')}
              >
                <span className={styles.attemptNum}>{i + 1}</span>
                <input
                  type="number"
                  value={val}
                  onChange={e => updateAttempt(i, e.target.value)}
                  placeholder="—"
                  min="0"
                />
                {isBest && <span className={`${styles.attemptTag} ${styles.tagBest}`}>best</span>}
                {isWorst && <span className={`${styles.attemptTag} ${styles.tagWorst}`}>worst</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Results */}
      <div className={styles.results}>
        <div className={`${styles.resultBox} ${styles.main}`}>
          <div className={styles.rLabel}>Ao5</div>
          <div className={[styles.rVal, styles.rValLarge, ao5 === null ? styles.muted : target && ao5 <= target ? styles.nrBeat : ''].join(' ')}>
            {ao5 !== null ? fmt(ao5) : '—'}
          </div>
        </div>
        <div className={styles.resultBox}>
          <div className={styles.rLabel}>WPA <span className={styles.sub}>worst possible</span></div>
          <div className={[styles.rVal, wpa === null ? styles.muted : ''].join(' ')}>{fmt(wpa)}</div>
        </div>
        <div className={styles.resultBox}>
          <div className={styles.rLabel}>BPA <span className={styles.sub}>best possible</span></div>
          <div className={[styles.rVal, bpa === null ? styles.muted : ''].join(' ')}>{fmt(bpa)}</div>
        </div>
      </div>

      {/* Min required */}
      <div className={styles.minReqBox}>
        <div className={styles.rLabel}>Min. required for Target (next solve)</div>
        <div className={styles.minReqInner}>
          {minr.val === null && (
            <><div className={`${styles.rVal} ${styles.muted}`}>—</div><div className={styles.rSub}>{minr.msg}</div></>
          )}
          {minr.guaranteed && (
            <><div className={`${styles.rVal} ${styles.guaranteed}`}>{minr.val}</div><div className={styles.rSub}>{minr.msg}</div></>
          )}
          {minr.val === 'IMPOSSIBLE' && (
            <><div className={`${styles.rVal} ${styles.impossible}`}>IMPOSSIBLE</div><div className={styles.rSub}>{minr.msg}</div></>
          )}
          {typeof minr.val === 'number' && (
            <><div className={`${styles.rVal} ${styles.gold}`}>{fmt(minr.val)}</div><div className={styles.rSub}>{minr.msg}</div></>
          )}
        </div>
      </div>

      <button className={styles.btnClear} onClick={clearAll}>Clear All Values</button>

      <footer className={styles.footer}>Ao5 Calculator · by tankuoping@gmail.com</footer>
    </div>
  )
}
