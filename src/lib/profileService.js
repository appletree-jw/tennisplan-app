// =====================================================================
// profileService.js — 본인 정보 수정 (이름·성별·비밀번호)
// 프로필 수정은 RLS users_self_update(본인 행만) 로 허용됨.
// =====================================================================
import { supabase } from './supabaseClient.js'

export async function updateMyProfile(userId, { name, gender }) {
  const { error } = await supabase
    .from('users')
    .update({ name: name.trim(), gender })
    .eq('id', userId)
  if (error) throw error
}

export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
