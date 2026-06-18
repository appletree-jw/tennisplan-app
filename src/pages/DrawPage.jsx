import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toPng } from 'html-to-image'
import { generateDraw } from '../lib/drawGenerator.js'
import { saveDraw } from '../lib/drawService.js'
import { loadMembers } from '../lib/memberService.js'
import { useAuth } from '../lib/auth.jsx'
import { genderLabel } from '../lib/labels.js'
import DrawResult from '../components/DrawResult.jsx'

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function DrawPage() {
  const { isLoggedIn, user, hasPermission } = useAuth()
  const canCreate = hasPermission('draw:create')
  // 참석자 = 선택된 클럽원 + 게스트. {name, gender, isGuest}
  const [participants, setParticipants] = useState([])
  const [members, setMembers] = useState([])
  const [membersError, setMembersError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestGender, setGuestGender] = useState('M')
  const [date, setDate] = useState(todayStr())
  const [startTime, setStartTime] = useState('06:20')
  const [draw, setDraw] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [savedId, setSavedId] = useState('')
  const captureRef = useRef(null)

  const males = participants.filter((p) => p.gender === 'M').length
  const females = participants.filter((p) => p.gender === 'F').length
  const selectedNames = new Set(participants.map((p) => p.name))

  useEffect(() => {
    let active = true
    loadMembers()
      .then((m) => active && setMembers(m))
      .catch((err) => active && setMembersError(err.message))
    return () => {
      active = false
    }
  }, [])

  function toggleMember(m) {
    setError('')
    setParticipants((prev) =>
      prev.some((p) => p.name === m.name)
        ? prev.filter((p) => p.name !== m.name)
        : [...prev, { name: m.name, gender: m.gender, isGuest: false }],
    )
  }

  function addGuest(e) {
    e.preventDefault()
    const trimmed = guestName.trim()
    if (!trimmed) return
    if (selectedNames.has(trimmed)) {
      setError(`이미 추가된 이름입니다: ${trimmed}`)
      return
    }
    setParticipants([...participants, { name: trimmed, gender: guestGender, isGuest: true }])
    setGuestName('')
    setError('')
  }

  function removeParticipant(target) {
    setParticipants(participants.filter((p) => p.name !== target))
  }

  async function handleSaveImage() {
    if (!captureRef.current) return
    setSaving(true)
    try {
      const dataUrl = await toPng(captureRef.current, {
        pixelRatio: 2,
        backgroundColor: '#181b22',
      })
      const link = document.createElement('a')
      link.download = `대진표_${draw?.date || todayStr()}.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      setError(`이미지 저장 실패: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    setError('')
    setSaving(true)
    try {
      const id = await saveDraw(draw, user?.id)
      const url = `${window.location.origin}/draw/${id}`
      setShareUrl(url)
      setSavedId(id)
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        /* 클립보드 권한 없으면 무시 — URL 은 화면에 표시됨 */
      }
    } catch (err) {
      setError(`저장 실패: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  function handleGenerate(reseed = false) {
    setError('')
    setShareUrl('')
    setSavedId('')
    try {
      const result = generateDraw({
        participants,
        date,
        startTime,
        seed: reseed ? Math.floor(Math.random() * 0xffffffff) : draw?.seed,
      })
      setDraw(result)
    } catch (err) {
      setError(err.message)
      setDraw(null)
    }
  }

  if (!canCreate)
    return (
      <div className="home-landing">
        <div className="hero">🎾</div>
        <h1>테니스 대진표</h1>
        {isLoggedIn ? (
          <>
            <p>대진표를 확인하고 스코어를 입력하세요.</p>
            <div className="home-actions">
              <Link to="/sessions" className="home-btn primary">대진표 목록</Link>
              <Link to="/stats" className="home-btn">통계 보기</Link>
            </div>
            <p className="hint">대진 생성·수정은 관리자만 가능합니다.</p>
          </>
        ) : (
          <>
            <p>공유받은 대진표는 링크로 바로 볼 수 있습니다.</p>
            <div className="home-actions">
              <Link to="/login" className="home-btn primary">로그인</Link>
              <Link to="/signup" className="home-btn">회원가입</Link>
            </div>
          </>
        )}
      </div>
    )

  return (
    <div className="layout">
      {/* ---- 참석자 선택 ---- */}
      <section className="panel">
        <h2>참석자 ({participants.length}명 · 남 {males} / 여 {females})</h2>

        {/* 클럽원 선택 */}
        <div className="member-section">
          <div className="section-label">클럽원 선택</div>
          {membersError && <p className="error">회원 목록 로드 실패: {membersError}</p>}
          {members.length === 0 && !membersError && (
            <p className="hint">등록된 클럽원이 없습니다. 회원가입을 받으세요.</p>
          )}
          <div className="member-chips">
            {members.map((m) => {
              const on = selectedNames.has(m.name)
              return (
                <button
                  type="button"
                  key={m.username}
                  className={`member-chip ${m.gender === 'F' ? 'female' : 'male'} ${on ? 'on' : ''}`}
                  onClick={() => toggleMember(m)}
                >
                  <span className="badge">{genderLabel(m.gender)}</span>
                  {m.name}
                  {on && <span className="check">✓</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* 게스트 추가 */}
        <div className="guest-section">
          <div className="section-label">게스트 추가</div>
          <form className="add-form" onSubmit={addGuest}>
            <input
              type="text"
              placeholder="게스트 이름"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
            />
            <div className="seg">
              <button
                type="button"
                className={guestGender === 'M' ? 'active' : ''}
                onClick={() => setGuestGender('M')}
              >
                남
              </button>
              <button
                type="button"
                className={guestGender === 'F' ? 'active' : ''}
                onClick={() => setGuestGender('F')}
              >
                여
              </button>
            </div>
            <button type="submit" className="primary">
              추가
            </button>
          </form>
        </div>

        {/* 선택된 참석자 */}
        <div className="section-label">선택된 참석자</div>
        <ul className="participant-list">
          {participants.map((p) => (
            <li key={p.name} className={p.gender === 'F' ? 'female' : 'male'}>
              <span className="badge">{genderLabel(p.gender)}</span>
              {p.name}
              {p.isGuest && <span className="guest-tag">게스트</span>}
              <button
                type="button"
                className="remove"
                onClick={() => removeParticipant(p.name)}
                aria-label="삭제"
              >
                ×
              </button>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="empty">클럽원을 선택하거나 게스트를 추가하세요 (최소 4명).</li>
          )}
        </ul>

        <div className="controls">
          <label>
            날짜
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            시작 시간
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary big"
            disabled={participants.length < 4}
            onClick={() => handleGenerate(true)}
          >
            대진 생성
          </button>
          {draw && (
            <button type="button" className="big" onClick={() => handleGenerate(true)}>
              다시 생성
            </button>
          )}
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      {/* ---- 대진표 출력 ---- */}
      {draw && (
        <section className="panel result">
          <div className="result-toolbar">
            <button type="button" onClick={handleSaveImage} disabled={saving}>
              {saving ? '처리 중…' : '🖼 이미지 저장'}
            </button>
            {isLoggedIn ? (
              <button type="button" onClick={handleShare} disabled={saving}>
                {saving ? '처리 중…' : savedId ? '✅ 확정됨' : '✅ 대진표 확정 (저장·공유)'}
              </button>
            ) : (
              <span className="hint">대진표 확정·저장은 로그인 후 가능</span>
            )}
          </div>

          {shareUrl && (
            <div className="share-url">
              <span>공유 링크 (복사됨):</span>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
              <Link to={`/draw/${savedId}`} className="score-link">
                ✏️ 상세·스코어 입력
              </Link>
            </div>
          )}

          <div className="capture" ref={captureRef}>
            <DrawResult draw={draw} />
          </div>
        </section>
      )}
    </div>
  )
}
