// =====================================================================
// auth.jsx
// Supabase Auth 기반 인증/RBAC 컨텍스트
//
// 설계 메모:
// - 로그인 식별자는 "아이디(username)" (PLAN §2 "Supabase Auth 아이디/비번").
//   Supabase Auth 는 email 을 요구하므로 username → 합성 이메일로 매핑한다.
//   (username "kim" → "kim@tennisplan.local"). 실제 이메일로 바꾸려면
//   usernameToEmail 만 교체하면 된다.
// - 권한은 DB(user_roles → role_permissions → permissions)에서 조회한다.
//   비로그인(게스트)은 'draw:read' 만 가진다 (PLAN §3 매트릭스).
//
// TODO(키 연결 후):
//   - 프로필/기본역할 생성을 DB 트리거로 옮기고 RLS 정책 추가 (현재는 클라이언트 insert).
// =====================================================================

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient.js'
import { usernameToEmail, GUEST_PERMISSIONS } from './authHelpers.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null) // public.users 행
  const [permissions, setPermissions] = useState(GUEST_PERMISSIONS)
  const [loading, setLoading] = useState(true)

  // 로그인 유저의 프로필 + 권한 로드
  const loadUserData = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setPermissions(GUEST_PERMISSIONS)
      return
    }
    const { data: prof } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(prof ?? null)

    // user_roles → role_permissions → permissions
    const { data: perms } = await supabase
      .from('user_roles')
      .select('roles(role_permissions(permissions(action)))')
      .eq('user_id', userId)
    const actions = new Set(GUEST_PERMISSIONS)
    for (const ur of perms ?? []) {
      for (const rp of ur.roles?.role_permissions ?? []) {
        if (rp.permissions?.action) actions.add(rp.permissions.action)
      }
    }
    setPermissions([...actions])
  }, [])

  // 세션 구독
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      loadUserData(data.session?.user?.id).finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      loadUserData(sess?.user?.id)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadUserData])

  // --- 액션 ---
  const signUp = useCallback(async ({ username, password, name, gender }) => {
    // 프로필(users)과 기본 member 역할은 DB 트리거 handle_new_user 가
    // auth.users insert 시점에 생성한다 (0004 마이그레이션). 메타데이터로 전달.
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: {
        data: { username: username.trim(), name: name.trim(), gender },
      },
    })
    if (error) throw error
    if (data.user?.id) await loadUserData(data.user.id)
    return data
  }, [loadUserData])

  const signIn = useCallback(async ({ username, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setPermissions(GUEST_PERMISSIONS)
  }, [])

  const hasPermission = useCallback(
    (action) => permissions.includes(action),
    [permissions],
  )

  const refreshProfile = useCallback(
    () => loadUserData(session?.user?.id),
    [loadUserData, session],
  )

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    permissions,
    loading,
    isLoggedIn: !!session,
    signUp,
    signIn,
    signOut,
    hasPermission,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 내부에서만 사용할 수 있습니다.')
  return ctx
}
