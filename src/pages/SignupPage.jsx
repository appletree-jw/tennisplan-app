import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    gender: 'M',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signUp(form)
      navigate('/')
    } catch (err) {
      setError(err.message || '회원가입에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <section className="panel auth-panel">
        <h2>회원가입</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            아이디
            <input type="text" value={form.username} onChange={set('username')} autoFocus required />
          </label>
          <label>
            비밀번호
            <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
          </label>
          <label>
            이름 (대진표 표시용)
            <input type="text" value={form.name} onChange={set('name')} required />
          </label>
          <label>
            성별
            <div className="seg">
              <button
                type="button"
                className={form.gender === 'M' ? 'active' : ''}
                onClick={() => setForm({ ...form, gender: 'M' })}
              >
                남
              </button>
              <button
                type="button"
                className={form.gender === 'F' ? 'active' : ''}
                onClick={() => setForm({ ...form, gender: 'F' })}
              >
                여
              </button>
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary big" disabled={busy}>
            {busy ? '가입 중…' : '회원가입'}
          </button>
        </form>
        <p className="auth-alt">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </div>
  )
}
