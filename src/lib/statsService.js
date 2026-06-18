// =====================================================================
// statsService.js
// 통계 조회 (summary_stats, 이름 기준). Step 6 대시보드용.
// =====================================================================
import { supabase } from './supabaseClient.js'

// 전체 선수 통계 — 승률 내림차순, 동률이면 경기수 많은 순
export async function loadAllStats() {
  const { data, error } = await supabase
    .from('summary_stats')
    .select('*')
    .order('win_rate', { ascending: false })
    .order('total_games', { ascending: false })
  if (error) throw error
  return data ?? []
}

// 페어 궁합 통계 (같은 팀 2인 조합 승률). min_games 이상만.
export async function loadPairStats(minGames = 1) {
  const { data, error } = await supabase.rpc('get_pair_stats', { min_games: minGames })
  if (error) throw error
  return data ?? []
}
