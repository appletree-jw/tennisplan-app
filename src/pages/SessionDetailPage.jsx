import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { useAuth } from '../lib/auth.jsx'
import { generateDraw } from '../lib/drawGenerator.js'
import { loadDraw, saveSessionEdits, regenerateSession } from '../lib/drawService.js'
import { loadSessionMatches, saveScore } from '../lib/scoreService.js'
import { loadMembers } from '../lib/memberService.js'
import { genderLabel, winnerLabel } from '../lib/labels.js'
import DrawResult from '../components/DrawResult.jsx'

const keyOf = (slotNo, court) => `${slotNo}-${court}`

// 스냅샷(팀+휴식)에서 전체 참가자 이름 추출 — participants 미저장 세션 대비
function namesFromDraw(draw) {
  const set = new Set()
  for (const s of draw?.slots ?? []) {
    for (const c of Object.values(s.courts ?? {})) {
      ;(c.teamA ?? []).forEach((n) => set.add(n))
      ;(c.teamB ?? []).forEach((n) => set.add(n))
    }
    ;(s.resting ?? []).forEach((n) => set.add(n))
  }
  return [...set]
}

// 슬롯별 휴식 = 풀 − 그 슬롯에서 뛰는 사람
function recomputeResting(draw, poolNames) {
  return {
    ...draw,
    slots: draw.slots.map((s) => {
      const playing = new Set()
      for (const c of Object.values(s.courts ?? {})) {
        ;(c.teamA ?? []).forEach((n) => playing.add(n))
        ;(c.teamB ?? []).forEach((n) => playing.add(n))
      }
      return { ...s, resting: poolNames.filter((n) => !playing.has(n)) }
    }),
  }
}

export default function SessionDetailPage() {
  const { id } = useParams()
  const { isLoggedIn, user, hasPermission } = useAuth()
  const [draw, setDraw] = useState(null)
  const [matchMap, setMatchMap] = useState({}) // "slot-court" -> {id, team_a, team_b, score}
  const [inputs, setInputs] = useState({}) // matchId -> {a, b}
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  // 수정 모드
  const [editMode, setEditMode] = useState(false)
  const [working, setWorking] = useState(null) // 편집 중 draw 사본
  const [pool, setPool] = useState([]) // [{name, gender, isGuest}]
  const [members, setMembers] = useState([])
  const [guestName, setGuestName] = useState('')
  const [guestGender, setGuestGender] = useState('M')
  const [busy, setBusy] = useState(false)
  const captureRef = useRef(null)

  const canWrite = isLoggedIn && hasPermission('score:write')
  const canEdit = isLoggedIn && hasPermission('draw:update')
  const poolNames = pool.map((p) => p.name)

  function applyData(snapshot, matches) {
    const map = {}
    const init = {}
    for (const m of matches) {
      map[keyOf(m.slot_no, m.court)] = m
      init[m.id] = { a: m.score?.score_a ?? '', b: m.score?.score_b ?? '' }
    }
    setDraw(snapshot)
    setMatchMap(map)
    setInputs(init)
  }

  useEffect(() => {
    let active = true
    Promise.all([loadDraw(id), loadSessionMatches(id)])
      .then(([snapshot, matches]) => {
        if (!active) return
        if (!snapshot) return setStatus('notfound')
        applyData(snapshot, matches)
        setStatus('ok')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [id])

  function enterEdit() {
    const w = structuredClone(draw)
    const initPool = draw.participants?.length
      ? draw.participants.map((p) => ({ ...p }))
      : namesFromDraw(draw).map((n) => ({ name: n, gender: null, isGuest: true }))
    setWorking(w)
    setPool(initPool)
    setEditMode(true)
    setError('')
    if (members.length === 0) loadMembers().then(setMembers).catch(() => {})
  }

  function cancelEdit() {
    setEditMode(false)
    setWorking(null)
    setError('')
  }

  // 경기 한 자리 선수 변경 (posIdx: 0,1 = teamA / 2,3 = teamB)
  function setPlayer(slotNo, court, posIdx, name) {
    setWorking((prev) => {
      const next = {
        ...prev,
        slots: prev.slots.map((s) => {
          if (s.slotNo !== slotNo) return s
          const m = s.courts[court]
          const teamA = [...m.teamA]
          const teamB = [...m.teamB]
          if (posIdx < 2) teamA[posIdx] = name
          else teamB[posIdx - 2] = name
          return { ...s, courts: { ...s.courts, [court]: { ...m, teamA, teamB } } }
        }),
      }
      return recomputeResting(next, poolNames)
    })
  }

  function addMemberToPool(m) {
    if (poolNames.includes(m.name)) return
    const names = [...poolNames, m.name]
    setPool((p) => [...p, { name: m.name, gender: m.gender, isGuest: false }])
    setWorking((w) => recomputeResting(w, names))
  }

  function addGuestToPool(e) {
    e.preventDefault()
    const n = guestName.trim()
    if (!n) return
    if (poolNames.includes(n)) {
      setError(`이미 명단에 있습니다: ${n}`)
      return
    }
    const names = [...poolNames, n]
    setPool((p) => [...p, { name: n, gender: guestGender, isGuest: true }])
    setWorking((w) => recomputeResting(w, names))
    setGuestName('')
    setError('')
  }

  function setPoolGender(name, gender) {
    setPool((p) => p.map((x) => (x.name === name ? { ...x, gender } : x)))
  }

  async function handleRegenerate() {
    const missing = pool.filter((p) => p.gender !== 'M' && p.gender !== 'F').map((p) => p.name)
    if (missing.length) return setError(`성별 미지정: ${missing.join(', ')} — 각 칩에서 남/여를 지정하세요.`)
    if (pool.length < 4) return setError('최소 4명이 필요합니다.')
    if (!window.confirm('전체를 다시 짜면 입력된 스코어가 모두 사라집니다. 진행할까요?')) return
    setBusy(true)
    setError('')
    try {
      const fresh = generateDraw({
        participants: pool,
        date: draw.date,
        startTime: draw.config?.startTime,
        seed: Math.floor(Math.random() * 0xffffffff),
      })
      await regenerateSession(id, fresh)
      const matches = await loadSessionMatches(id)
      applyData(fresh, matches)
      setEditMode(false)
      setWorking(null)
    } catch (e) {
      setError(`재생성 실패: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  function removeFromPool(name) {
    const inMatch = working.slots.some((s) =>
      Object.values(s.courts).some(
        (c) => c.teamA.includes(name) || c.teamB.includes(name),
      ),
    )
    if (inMatch) {
      setError(`${name} 님은 아직 경기에 배정돼 있습니다. 먼저 해당 경기에서 다른 사람으로 교체하세요.`)
      return
    }
    const names = poolNames.filter((x) => x !== name)
    setPool((p) => p.filter((x) => x.name !== name))
    setWorking((w) => recomputeResting(w, names))
    setError('')
  }

  function validateWorking(w) {
    for (const s of w.slots) {
      const playing = []
      for (const c of Object.values(s.courts)) {
        const four = [...c.teamA, ...c.teamB]
        if (four.some((x) => !x)) return `슬롯 ${s.slotNo}: 빈 자리가 있습니다.`
        playing.push(...four)
      }
      if (new Set(playing).size !== playing.length)
        return `슬롯 ${s.slotNo}: 같은 사람이 두 경기에 배정됐습니다.`
    }
    return null
  }

  async function handleSaveEdits() {
    const err = validateWorking(working)
    if (err) return setError(err)
    setBusy(true)
    setError('')
    try {
      const matchUpdates = []
      for (const s of working.slots) {
        for (const [court, m] of Object.entries(s.courts)) {
          const dbm = matchMap[keyOf(s.slotNo, court)]
          if (dbm) matchUpdates.push({ matchId: dbm.id, teamA: m.teamA, teamB: m.teamB })
        }
      }
      const saved = { ...working, participants: pool }
      await saveSessionEdits(id, saved, matchUpdates)
      // 로컬 반영 (스코어 유지)
      setMatchMap((prev) => {
        const next = { ...prev }
        for (const s of working.slots)
          for (const [court, m] of Object.entries(s.courts)) {
            const k = keyOf(s.slotNo, court)
            if (next[k]) next[k] = { ...next[k], team_a: m.teamA, team_b: m.teamB }
          }
        return next
      })
      setDraw(saved)
      setEditMode(false)
      setWorking(null)
    } catch (e) {
      setError(`저장 실패: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveImage() {
    if (!captureRef.current) return
    const dataUrl = await toPng(captureRef.current, { pixelRatio: 2, backgroundColor: '#181b22' })
    const link = document.createElement('a')
    link.download = `대진표_${draw?.date || id}.png`
    link.href = dataUrl
    link.click()
  }

  async function handleSaveScore(matchId) {
    const { a, b } = inputs[matchId] || {}
    if (a === '' || b === '' || a == null || b == null) return setError('양 팀 점수를 입력하세요.')
    setError('')
    setSavingId(matchId)
    try {
      const winner = await saveScore(matchId, a, b, user?.id)
      setMatchMap((prev) => {
        const next = { ...prev }
        for (const k in next)
          if (next[k].id === matchId)
            next[k] = { ...next[k], score: { score_a: Number(a), score_b: Number(b), winner } }
        return next
      })
    } catch (err) {
      setError(`저장 실패: ${err.message}`)
    } finally {
      setSavingId(null)
    }
  }

  // 경기 칸 추가 UI: 수정 모드 → 선수 드롭다운 / 일반 → 스코어
  function renderMatchExtra(slotNo, court) {
    if (editMode && canEdit) {
      const m = working.slots.find((s) => s.slotNo === slotNo)?.courts[court]
      if (!m) return null
      const cur = [m.teamA[0], m.teamA[1], m.teamB[0], m.teamB[1]]
      return (
        <div className="team-edit">
          {[0, 1, 2, 3].map((i) => (
            <select key={i} value={cur[i] ?? ''} onChange={(e) => setPlayer(slotNo, court, i, e.target.value)}>
              {poolNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          ))}
        </div>
      )
    }

    const dbm = matchMap[keyOf(slotNo, court)]
    if (!dbm) return null
    const sc = dbm.score
    if (!canWrite)
      return sc ? (
        <div className="score-readout">
          {sc.score_a} : {sc.score_b} <span className="winner">{winnerLabel(sc.winner)}</span>
        </div>
      ) : (
        <div className="score-readout muted">미입력</div>
      )
    return (
      <div className="score-entry">
        <input type="number" min="0" value={inputs[dbm.id]?.a ?? ''}
          onChange={(e) => setInputs((p) => ({ ...p, [dbm.id]: { ...p[dbm.id], a: e.target.value } }))} />
        <span>:</span>
        <input type="number" min="0" value={inputs[dbm.id]?.b ?? ''}
          onChange={(e) => setInputs((p) => ({ ...p, [dbm.id]: { ...p[dbm.id], b: e.target.value } }))} />
        <button type="button" className="primary" disabled={savingId === dbm.id} onClick={() => handleSaveScore(dbm.id)}>
          {savingId === dbm.id ? '…' : sc ? '수정' : '저장'}
        </button>
        {sc && <span className="winner">{winnerLabel(sc.winner)}</span>}
      </div>
    )
  }

  if (status === 'loading') return <p className="centered-msg">불러오는 중…</p>
  if (status === 'notfound') return <p className="centered-msg">존재하지 않는 대진표입니다.</p>
  if (status === 'error') return <p className="centered-msg error">불러오기 실패: {error}</p>

  const shown = editMode ? working : draw
  const poolNameSet = new Set(poolNames)
  const availMembers = members.filter((m) => !poolNameSet.has(m.name))

  return (
    <div className="shared-wrap">
      <section className="panel result">
        <div className="result-toolbar">
          <button type="button" onClick={handleSaveImage}>🖼 이미지 저장</button>
          {canEdit && !editMode && (
            <button type="button" onClick={enterEdit}>✏️ 대진 수정</button>
          )}
          {canEdit && editMode && (
            <>
              <button type="button" className="primary" onClick={handleSaveEdits} disabled={busy}>
                {busy ? '저장 중…' : '✅ 변경 저장'}
              </button>
              <button type="button" onClick={handleRegenerate} disabled={busy}>
                🔄 전체 다시 짜기
              </button>
              <button type="button" onClick={cancelEdit} disabled={busy}>취소</button>
            </>
          )}
          {!canWrite && !canEdit && (
            <span className="hint">{isLoggedIn ? '편집 권한이 없습니다.' : <Link to="/login">로그인</Link>}</span>
          )}
        </div>

        {editMode && (
          <div className="roster-editor">
            <div className="section-label">참석자 명단 ({pool.length}명) — 추가/제외 후 경기 드롭다운으로 배치</div>
            <ul className="participant-list">
              {pool.map((p) => (
                <li key={p.name} className={p.gender === 'F' ? 'female' : 'male'}>
                  <span className="badge">{genderLabel(p.gender)}</span>
                  {p.name}
                  {p.gender !== 'M' && p.gender !== 'F' && (
                    <span className="gender-set">
                      <button type="button" onClick={() => setPoolGender(p.name, 'M')}>남</button>
                      <button type="button" onClick={() => setPoolGender(p.name, 'F')}>여</button>
                    </span>
                  )}
                  {p.isGuest && <span className="guest-tag">게스트</span>}
                  <button type="button" className="remove" onClick={() => removeFromPool(p.name)} aria-label="제외">×</button>
                </li>
              ))}
            </ul>
            <div className="roster-add">
              {availMembers.length > 0 && (
                <select defaultValue="" onChange={(e) => { const m = members.find((x) => x.name === e.target.value); if (m) addMemberToPool(m); e.target.value = '' }}>
                  <option value="" disabled>+ 클럽원 추가</option>
                  {availMembers.map((m) => (
                    <option key={m.username} value={m.name}>{m.name} ({genderLabel(m.gender)})</option>
                  ))}
                </select>
              )}
              <form className="guest-inline" onSubmit={addGuestToPool}>
                <input type="text" placeholder="게스트 이름" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                <div className="seg">
                  <button type="button" className={guestGender === 'M' ? 'active' : ''} onClick={() => setGuestGender('M')}>남</button>
                  <button type="button" className={guestGender === 'F' ? 'active' : ''} onClick={() => setGuestGender('F')}>여</button>
                </div>
                <button type="submit" className="primary">게스트 추가</button>
              </form>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="capture" ref={captureRef}>
          <DrawResult draw={shown} renderMatchExtra={renderMatchExtra} />
        </div>
      </section>
    </div>
  )
}
