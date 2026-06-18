// =====================================================================
// memberService.js
// 등록 클럽원(users 프로필) 조회 — 대진 참석자 선택용.
// =====================================================================
import { supabase } from './supabaseClient.js'

// 최고관리자(super-admin) 계정 식별자.
// 비상 대비용 백업 슈퍼관리자라 참가자 후보에서만 제외한다. (admin "역할"과 무관)
// username 으로 고정 — UUID는 DB 재생성 시 바뀌지만 'admin' 은 부트스트랩 규약(0010_grant_first_admin.sql)상 고정.
const SUPER_ADMIN_USERNAME = 'admin'

// 활성 클럽원 목록 (성별이 설정된 회원만 — 대진 배정에 성별 필요)
// 슈퍼관리자 계정만 제외. admin "역할"을 가진 실제 회원(예: 운영진 본인)은 선수로 노출된다.
export async function loadMembers() {
  const { data, error } = await supabase
    .from('users')
    .select('username, name, gender, is_active')
    .eq('is_active', true)
    .in('gender', ['M', 'F'])
    .neq('username', SUPER_ADMIN_USERNAME)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}
