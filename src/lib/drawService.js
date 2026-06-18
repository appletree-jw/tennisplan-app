// =====================================================================
// drawService.js
// 대진표 저장/조회 (Supabase). DrawPage(저장) / SharedDrawPage(조회) 공용.
// =====================================================================
import { supabase } from './supabaseClient.js'

// 생성된 대진표를 sessions(스냅샷) + matches(정규화)에 저장. 세션 id 반환.
export async function saveDraw(draw, createdBy) {
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      date: draw.date,
      total_slots: draw.config.slots,
      created_by: createdBy ?? null,
      draw_json: draw,
    })
    .select('id')
    .single()
  if (error) throw error

  // 정규화 matches (스코어/통계용 RAW)
  const rows = matchRows(session.id, draw)
  if (rows.length) {
    const { error: mErr } = await supabase.from('matches').insert(rows)
    if (mErr) throw mErr
  }
  return session.id
}

// 저장된 대진표 목록 (최근 날짜순). 인원수는 스냅샷에서 추출.
export async function loadSessions(limit = 50) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, date, total_slots, created_at, draw_json')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    date: s.date,
    total_slots: s.total_slots,
    created_at: s.created_at,
    headcount: s.draw_json?.stats?.headcount ?? null,
  }))
}

// matches 행 생성용 — draw.slots → matches row 배열
function matchRows(sessionId, draw) {
  const rows = []
  for (const slot of draw.slots) {
    for (const [court, m] of Object.entries(slot.courts)) {
      rows.push({
        session_id: sessionId,
        slot_no: slot.slotNo,
        court,
        match_type: m.type,
        team_a: m.teamA,
        team_b: m.teamB,
      })
    }
  }
  return rows
}

// 재생성: 스냅샷·경기 전부 교체 (admin). ⚠️ 기존 matches 삭제 → 스코어도 함께 사라짐.
export async function regenerateSession(sessionId, draw) {
  const { error: e1 } = await supabase
    .from('sessions')
    .update({ draw_json: draw, total_slots: draw.config.slots })
    .eq('id', sessionId)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('matches').delete().eq('session_id', sessionId)
  if (e2) throw e2
  const rows = matchRows(sessionId, draw)
  if (rows.length) {
    const { error: e3 } = await supabase.from('matches').insert(rows)
    if (e3) throw e3
  }
}

// 선수 교체: 한 경기의 팀 구성만 수정 (admin). matches 행 + 스냅샷 동기화.
export async function updateMatchTeams(sessionId, matchId, teamA, teamB, updatedDraw) {
  const { error: e1 } = await supabase
    .from('matches')
    .update({ team_a: teamA, team_b: teamB })
    .eq('id', matchId)
  if (e1) throw e1
  const { error: e2 } = await supabase
    .from('sessions')
    .update({ draw_json: updatedDraw })
    .eq('id', sessionId)
  if (e2) throw e2
}

// 최소 패치 저장: 바뀐 경기 팀만 in-place 업데이트(스코어 유지) + 스냅샷 동기화.
// matchUpdates: [{ matchId, teamA, teamB }]
export async function saveSessionEdits(sessionId, draw, matchUpdates) {
  for (const u of matchUpdates) {
    const { error } = await supabase
      .from('matches')
      .update({ team_a: u.teamA, team_b: u.teamB })
      .eq('id', u.matchId)
    if (error) throw error
  }
  const { error } = await supabase
    .from('sessions')
    .update({ draw_json: draw })
    .eq('id', sessionId)
  if (error) throw error
}

// 공유 id 로 대진표 스냅샷 조회 (게스트 읽기 허용). 없으면 null.
export async function loadDraw(id) {
  const { data, error } = await supabase
    .from('sessions')
    .select('draw_json')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data?.draw_json ?? null
}
