import { MATCH_TYPES, COURTS } from '../lib/drawConfig.js'

// 대진표 결과 표시 (생성·상세 화면 공용).
// renderMatchExtra(slotNo, court) 를 주면 각 경기 칸 아래에 추가 UI(스코어 등)를 렌더.
export default function DrawResult({ draw, renderMatchExtra }) {
  return (
    <>
      <div className="result-header">
        <strong>{draw.date}</strong>
        <span>총 {draw.stats.headcount}명</span>
        <span>{draw.config.slots}슬롯</span>
        <span>{draw.config.slotMinutes}분</span>
        <span>{draw.config.games}게임</span>
      </div>

      <div className="legend">
        {Object.entries(MATCH_TYPES).map(([t, spec]) => (
          <span key={t} className="legend-item">
            <span className="dot" style={{ background: spec.color }} />
            {t}
          </span>
        ))}
      </div>

      <table className="draw-table">
        <thead>
          <tr>
            <th>슬롯</th>
            <th>시간</th>
            <th>3코트</th>
            <th>4코트</th>
            <th>휴식</th>
          </tr>
        </thead>
        <tbody>
          {draw.slots.map((s) => (
            <tr key={s.slotNo}>
              <td className="slot-no">{s.slotNo}</td>
              <td>{s.time}</td>
              {COURTS.map((court) => (
                <td key={court}>
                  {s.courts[court] ? (
                    <>
                      <MatchCell match={s.courts[court]} />
                      {renderMatchExtra?.(s.slotNo, court)}
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              ))}
              <td className="resting">{s.resting.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {draw.warnings.length > 0 && (
        <div className="warnings">
          <strong>⚠ 특이사항</strong>
          <ul>
            {draw.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function MatchCell({ match }) {
  const color = MATCH_TYPES[match.type]?.color || '#666'
  return (
    <div className="match" style={{ borderLeftColor: color }}>
      <span className="type" style={{ color }}>
        {match.type}
      </span>
      <span className="teams">
        {match.teamA.join('·')} <em>vs</em> {match.teamB.join('·')}
      </span>
    </div>
  )
}
