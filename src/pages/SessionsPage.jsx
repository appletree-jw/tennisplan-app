import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { loadSessions } from '../lib/drawService.js'

export default function SessionsPage() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoggedIn) return
    let active = true
    loadSessions()
      .then((data) => {
        if (!active) return
        setRows(data)
        setStatus(data.length ? 'ok' : 'empty')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [isLoggedIn])

  if (!isLoggedIn)
    return (
      <p className="centered-msg">
        대진표 목록은 로그인 후 볼 수 있습니다. <Link to="/login">로그인</Link>
      </p>
    )
  if (status === 'loading') return <p className="centered-msg">불러오는 중…</p>
  if (status === 'error') return <p className="centered-msg error">불러오기 실패: {error}</p>
  if (status === 'empty')
    return (
      <p className="centered-msg">
        저장된 대진표가 없습니다. <Link to="/">대진 생성하기</Link>
      </p>
    )

  return (
    <div className="stats-wrap">
      <section className="panel">
        <h2>대진표 목록 ({rows.length})</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>인원</th>
              <th>슬롯</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                className="clickable-row"
                onClick={() => navigate(`/draw/${s.id}`)}
              >
                <td className="pname">{s.date}</td>
                <td>{s.headcount != null ? `${s.headcount}명` : '—'}</td>
                <td>{s.total_slots ?? '—'}</td>
                <td className="session-actions">
                  <Link to={`/draw/${s.id}`} onClick={(e) => e.stopPropagation()}>보기</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
