import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import {
  loadUsersWithRoles,
  setUserActive,
  setUserGender,
  addRole,
  removeRole,
  deleteUser,
  deleteSession,
} from '../lib/adminService.js'
import { loadSessions } from '../lib/drawService.js'
import { genderLabel } from '../lib/labels.js'

export default function AdminPage() {
  const { hasPermission, user } = useAuth()
  const canManage = hasPermission('member:manage')

  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    try {
      const [u, s] = await Promise.all([loadUsersWithRoles(), loadSessions()])
      setUsers(u)
      setSessions(s)
      setError('')
      setLoadedKey('done')
    } catch (err) {
      setError(err.message)
      setLoadedKey('done')
    }
  }

  useEffect(() => {
    if (!canManage) return
    let active = true
    Promise.all([loadUsersWithRoles(), loadSessions()])
      .then(([u, s]) => {
        if (!active) return
        setUsers(u)
        setSessions(s)
        setLoadedKey('done')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setLoadedKey('done')
      })
    return () => {
      active = false
    }
  }, [canManage])

  async function withBusy(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function toggleAdmin(u) {
    const isAdmin = u.roles.includes('admin')
    withBusy(() => (isAdmin ? removeRole(u.id, 'admin') : addRole(u.id, 'admin')))
  }

  function toggleActive(u) {
    withBusy(() => setUserActive(u.id, !u.is_active))
  }

  function changeGender(u, gender) {
    withBusy(() => setUserGender(u.id, gender))
  }

  function removeUser(u) {
    if (u.id === user?.id) {
      setError('본인 계정은 삭제할 수 없습니다.')
      return
    }
    if (!window.confirm(`${u.name} 회원을 삭제할까요? 프로필·역할이 삭제되며 되돌릴 수 없습니다.`)) return
    withBusy(() => deleteUser(u.id))
  }

  function removeSession(s) {
    if (!window.confirm(`${s.date} 대진표를 삭제할까요? (되돌릴 수 없음)`)) return
    withBusy(() => deleteSession(s.id))
  }

  if (!canManage)
    return (
      <p className="centered-msg">
        관리자 전용 페이지입니다. <Link to="/">홈으로</Link>
      </p>
    )
  if (loadedKey !== 'done') return <p className="centered-msg">불러오는 중…</p>

  return (
    <div className="stats-wrap">
      {error && <p className="error centered-msg">{error}</p>}

      <section className="panel">
        <h2>회원 관리 ({users.length}명)</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>이름</th><th>아이디</th><th>성별</th><th>역할</th><th>상태</th><th>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="pname">{u.name}</td>
                <td>{u.username}</td>
                <td>
                  {u.gender ? genderLabel(u.gender) : <span className="muted">미지정</span>}
                  <span className="gender-set">
                    <button type="button" disabled={busy} onClick={() => changeGender(u, 'M')}>남</button>
                    <button type="button" disabled={busy} onClick={() => changeGender(u, 'F')}>여</button>
                  </span>
                </td>
                <td>{u.roles.join(', ') || '—'}</td>
                <td>{u.is_active ? '활성' : '비활성'}</td>
                <td className="session-actions">
                  <button type="button" className="link-btn" disabled={busy} onClick={() => toggleAdmin(u)}>
                    {u.roles.includes('admin') ? 'admin 회수' : 'admin 부여'}
                  </button>
                  <button type="button" className="link-btn" disabled={busy} onClick={() => toggleActive(u)}>
                    {u.is_active ? '비활성화' : '활성화'}
                  </button>
                  {u.id !== user?.id && (
                    <button type="button" className="link-btn danger" disabled={busy} onClick={() => removeUser(u)}>
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>대진표 관리 ({sessions.length})</h2>
        <table className="stats-table">
          <thead>
            <tr>
              <th>날짜</th><th>인원</th><th>슬롯</th><th>관리</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="pname">{s.date}</td>
                <td>{s.headcount != null ? `${s.headcount}명` : '—'}</td>
                <td>{s.total_slots ?? '—'}</td>
                <td className="session-actions">
                  <Link to={`/draw/${s.id}`}>보기</Link>
                  <button type="button" className="link-btn danger" disabled={busy} onClick={() => removeSession(s)}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={4} className="muted">저장된 대진표가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
