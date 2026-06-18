// =====================================================================
// memberService.js
// 등록 클럽원(users 프로필) 조회 — 대진 참석자 선택용.
// =====================================================================
import { supabase } from './supabaseClient.js'

// 활성 클럽원 목록 (성별이 설정된 회원만 — 대진 배정에 성별 필요)
// admin 역할 보유자는 대진 관리 전담이므로 참가자 후보에서 제외한다.
// (대진 생성/수정은 admin 컨텍스트라 RLS상 전체 user_roles 조회 가능)
export async function loadMembers() {
  const { data: admins, error: adminErr } = await supabase
    .from('user_roles')
    .select('user_id, roles!inner(name)')
    .eq('roles.name', 'admin')
  if (adminErr) throw adminErr
  const adminIds = (admins ?? []).map((r) => r.user_id)

  let query = supabase
    .from('users')
    .select('username, name, gender, is_active')
    .eq('is_active', true)
    .in('gender', ['M', 'F'])
    .order('name', { ascending: true })
  if (adminIds.length > 0) {
    query = query.not('id', 'in', `(${adminIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
