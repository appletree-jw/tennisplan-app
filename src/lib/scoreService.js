// =====================================================================
// scoreService.js
// 세션의 경기 목록 + 스코어 조회/저장 (Supabase).
// =====================================================================
import { supabase } from './supabaseClient.js'

// 한 세션의 경기들을 스코어와 함께 로드 (슬롯/코트 순)
export async function loadSessionMatches(sessionId) {
  const { data, error } = await supabase
    .from('matches')
    .select('id, slot_no, court, match_type, team_a, team_b, scores(score_a, score_b, winner)')
    .eq('session_id', sessionId)
    .order('slot_no', { ascending: true })
    .order('court', { ascending: true })
  if (error) throw error
  // scores.match_id 가 unique(0006) 라 PostgREST 는 to-one(객체)로 반환.
  // (구버전/조건에 따라 배열일 수도 있어 둘 다 안전 처리)
  return (data ?? []).map((m) => ({
    ...m,
    score: Array.isArray(m.scores) ? (m.scores[0] ?? null) : (m.scores ?? null),
  }))
}

// 세션 메타(날짜) 조회
export async function loadSessionMeta(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('date, total_slots')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data
}

// 경기 스코어 저장 (upsert). 승자 자동 계산.
export async function saveScore(matchId, scoreA, scoreB, recordedBy) {
  const a = Number(scoreA)
  const b = Number(scoreB)
  const winner = a === b ? 'draw' : a > b ? 'A' : 'B'
  const { error } = await supabase
    .from('scores')
    .upsert(
      { match_id: matchId, score_a: a, score_b: b, winner, recorded_by: recordedBy ?? null },
      { onConflict: 'match_id' },
    )
  if (error) throw error
  return winner
}
