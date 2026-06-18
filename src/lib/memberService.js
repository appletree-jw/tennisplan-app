// =====================================================================
// memberService.js
// 등록 클럽원(users 프로필) 조회 — 대진 참석자 선택용.
// =====================================================================
import { supabase } from './supabaseClient.js'

// 활성 클럽원 목록 (성별이 설정된 회원만 — 대진 배정에 성별 필요)
export async function loadMembers() {
  const { data, error } = await supabase
    .from('users')
    .select('username, name, gender, is_active')
    .eq('is_active', true)
    .in('gender', ['M', 'F'])
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}
