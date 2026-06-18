// =====================================================================
// adminService.js
// 관리자 기능 — 회원 역할/활성 관리, 대진표 삭제. (admin RLS 전제)
// =====================================================================
import { supabase } from './supabaseClient.js'

// 회원 + 역할 목록
export async function loadUsersWithRoles() {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, name, gender, is_active, user_roles(roles(name))')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((u) => ({
    ...u,
    roles: (u.user_roles ?? []).map((ur) => ur.roles?.name).filter(Boolean),
  }))
}

export async function setUserActive(userId, active) {
  const { error } = await supabase.from('users').update({ is_active: active }).eq('id', userId)
  if (error) throw error
}

export async function setUserGender(userId, gender) {
  const { error } = await supabase.from('users').update({ gender }).eq('id', userId)
  if (error) throw error
}

// 회원 프로필 삭제 (auth 계정은 남음 — Admin API 필요). user_roles 는 cascade.
export async function deleteUser(userId) {
  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw error
}

async function roleId(name) {
  const { data, error } = await supabase.from('roles').select('id').eq('name', name).single()
  if (error) throw error
  return data.id
}

export async function addRole(userId, roleName) {
  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: userId, role_id: await roleId(roleName) })
  if (error) throw error
}

export async function removeRole(userId, roleName) {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('user_id', userId)
    .eq('role_id', await roleId(roleName))
  if (error) throw error
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}
