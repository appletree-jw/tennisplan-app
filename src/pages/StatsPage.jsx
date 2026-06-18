import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { loadAllStats, loadPairStats } from '../lib/statsService.js'

export default function StatsPage() {
  const { isLoggedIn, hasPermission } = useAuth()
  const [tab, setTab] = useState('personal') // personal | pairs
  const [rows, setRows] = useState([])
  const [pairs, setPairs] = useState([])
  const [minGames, setMinGames] = useState(1)
  const [loadedKey, setLoadedKey] = useState('')
  const [error, setError] = useState('')

  const canRead = isLoggedIn && hasPermission('stats:read')
  const currentKey = `${tab}-${minGames}`

  useEffect(() => {
    if (!canRead) return
    let active = true
    const job = tab === 'personal' ? loadAllStats() : loadPairStats(minGames)
    job
      .then((data) => {
        if (!active) return
        if (tab === 'personal') setRows(data)
        else setPairs(data)
        setError('')
        setLoadedKey(`${tab}-${minGames}`)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message)
        setLoadedKey(`${tab}-${minGames}`)
      })
    return () => {
      active = false
    }
  }, [canRead, tab, minGames])

  if (!canRead)
    return (
      <p className="centered-msg">
        통계는 로그인한 회원만 볼 수 있습니다. <Link to="/login">로그인</Link>
      </p>
    )

  const loading = loadedKey !== currentKey
  const data = tab === 'personal' ? rows : pairs

  return (
    <div className="stats-wrap">
      <section className="panel">
        <div className="stats-tabs">
          <button
            type="button"
            className={tab === 'personal' ? 'on' : ''}
            onClick={() => setTab('personal')}
          >
            개인 승률
          </button>
          <button
            type="button"
            className={tab === 'pairs' ? 'on' : ''}
            onClick={() => setTab('pairs')}
          >
            페어 궁합
          </button>
          {tab === 'pairs' && (
            <label className="min-games">
              최소 경기
              <select value={minGames} onChange={(e) => setMinGames(Number(e.target.value))}>
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}경기 이상
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading && <p className="centered-msg">불러오는 중…</p>}
        {!loading && error && <p className="centered-msg error">불러오기 실패: {error}</p>}
        {!loading && !error && data.length === 0 && (
          <p className="centered-msg">
            {tab === 'personal'
              ? '아직 집계된 통계가 없습니다. 스코어를 입력해 보세요.'
              : '조건에 맞는 페어가 없습니다. (경기 수를 낮춰보세요)'}
          </p>
        )}
        {!loading && !error && data.length > 0 && tab === 'personal' && (
          <PersonalTable rows={rows} />
        )}
        {!loading && !error && data.length > 0 && tab === 'pairs' && <PairTable pairs={pairs} />}
      </section>
    </div>
  )
}

function PersonalTable({ rows }) {
  return (
    <>
      <h2>개인 승률 ({rows.length}명)</h2>
      <table className="stats-table">
        <thead>
          <tr>
            <th>#</th><th>이름</th><th>경기</th><th>승</th><th>패</th><th>무</th>
            <th>승률</th><th>유형별</th><th>최근</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.player_name}>
              <td className="rank">{i + 1}</td>
              <td className="pname">{r.player_name}</td>
              <td>{r.total_games}</td>
              <td>{r.wins}</td>
              <td>{r.losses}</td>
              <td>{r.draws}</td>
              <td className="winrate">{Math.round((r.win_rate || 0) * 100)}%</td>
              <td className="bytype">
                {Object.entries(r.by_type || {}).map(([type, s]) => (
                  <span key={type} className="bytype-item">
                    {type} {s.wins}승{s.losses}패
                  </span>
                ))}
              </td>
              <td className="recent">
                {(r.recent_10 || []).map((g, idx) => (
                  <span key={idx} className={`dot-${g.result}`} title={`${g.type} ${g.result}`} />
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function PairTable({ pairs }) {
  return (
    <>
      <h2>페어 궁합 ({pairs.length}쌍)</h2>
      <table className="stats-table">
        <thead>
          <tr>
            <th>#</th><th>페어</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>궁합 승률</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p, i) => (
            <tr key={`${p.player_a}|${p.player_b}`}>
              <td className="rank">{i + 1}</td>
              <td className="pname">{p.player_a} · {p.player_b}</td>
              <td>{p.games}</td>
              <td>{p.wins}</td>
              <td>{p.losses}</td>
              <td>{p.draws}</td>
              <td className="winrate">{Math.round((p.win_rate || 0) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
