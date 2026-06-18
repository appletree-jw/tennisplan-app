import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { updateMyProfile, changePassword } from '../lib/profileService.js'

export default function ProfilePage() {
  const { isLoggedIn, profile } = useAuth()

  if (!isLoggedIn)
    return (
      <p className="centered-msg">
        로그인이 필요합니다. <Link to="/login">로그인</Link>
      </p>
    )
  if (!profile) return <p className="centered-msg">불러오는 중…</p>

  // profile 이 준비된 뒤에만 마운트 → 초기값을 안전하게 useState 로 설정
  return <ProfileForm profile={profile} />
}

function ProfileForm({ profile }) {
  const { user, refreshProfile } = useAuth()
  const [name, setName] = useState(profile.name || '')
  const [gender, setGender] = useState(profile.gender || 'M')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function saveProfile(e) {
    e.preventDefault()
    setError('')
    setMsg('')
    if (!name.trim()) return setError('이름을 입력하세요.')
    setBusy(true)
    try {
      await updateMyProfile(user.id, { name, gender })
      await refreshProfile()
      setMsg('프로필이 저장됐습니다.')
    } catch (err) {
      setError(`저장 실패: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setError('')
    setMsg('')
    if (pw.length < 6) return setError('비밀번호는 6자 이상이어야 합니다.')
    if (pw !== pw2) return setError('비밀번호 확인이 일치하지 않습니다.')
    setBusy(true)
    try {
      await changePassword(pw)
      setPw('')
      setPw2('')
      setMsg('비밀번호가 변경됐습니다.')
    } catch (err) {
      setError(`변경 실패: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <section className="panel auth-panel">
        <h2>내 정보</h2>
        <p className="hint">아이디: {profile.username}</p>

        {error && <p className="error">{error}</p>}
        {msg && <p className="success">{msg}</p>}

        <form className="auth-form" onSubmit={saveProfile}>
          <label>
            이름
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            성별
            <div className="seg">
              <button type="button" className={gender === 'M' ? 'active' : ''} onClick={() => setGender('M')}>남</button>
              <button type="button" className={gender === 'F' ? 'active' : ''} onClick={() => setGender('F')}>여</button>
            </div>
          </label>
          <button type="submit" className="primary big" disabled={busy}>
            {busy ? '저장 중…' : '프로필 저장'}
          </button>
        </form>

        <hr className="divider" />

        <form className="auth-form" onSubmit={savePassword}>
          <div className="section-label">비밀번호 변경</div>
          <label>
            새 비밀번호
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} />
          </label>
          <label>
            새 비밀번호 확인
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} />
          </label>
          <button type="submit" className="big" disabled={busy}>
            {busy ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </section>
    </div>
  )
}
