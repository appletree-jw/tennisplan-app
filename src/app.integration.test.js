// =====================================================================
// app.integration.test.js — 통합/관통(E2E) 테스트
// 실제 Supabase 백엔드에 서비스 코드를 그대로 호출해 전 흐름을 검증한다.
// 실행: npm run test:integration   (기본 npm test 에서는 제외됨)
//
// 검증 범위:
//  인증(admin/member) · RBAC 권한 · RLS(member 차단) · 대진 저장/조회 ·
//  게스트 읽기 · 스코어 입력 → summary_stats 트리거 · 페어 통계 ·
//  대진 수정(수동 패치/재생성) · 관리자(회원 역할·활성·세션 삭제)
//
// 사전 조건: admin 계정(admin/TennisAdmin2026!), member 계정(testuser1/test1234),
//            마이그레이션 0001~0011 적용 완료.
// =====================================================================
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { supabase } from './lib/supabaseClient.js'
import { generateDraw } from './lib/drawGenerator.js'
import { saveDraw, loadDraw, saveSessionEdits, regenerateSession } from './lib/drawService.js'
import { loadSessionMatches, saveScore } from './lib/scoreService.js'
import { loadAllStats, loadPairStats } from './lib/statsService.js'
import { loadUsersWithRoles, setUserActive, addRole, removeRole, deleteSession } from './lib/adminService.js'
import { loadMembers } from './lib/memberService.js'

const ADMIN = { email: 'admin@tennisplan.com', password: 'TennisAdmin2026!' }
const MEMBER = { email: 'testuser1@tennisplan.com', password: 'test1234' }
const RUN = Date.now().toString(36) // 실행마다 고유 → 통계 누적 방지

const asAdmin = () => supabase.auth.signInWithPassword(ADMIN)
const asMember = () => supabase.auth.signInWithPassword(MEMBER)
const asGuest = () => supabase.auth.signOut()

function roster(males, females) {
  const p = []
  for (let i = 1; i <= males; i++) p.push({ name: `T${RUN}_남${i}`, gender: 'M', isGuest: true })
  for (let i = 1; i <= females; i++) p.push({ name: `T${RUN}_여${i}`, gender: 'F', isGuest: true })
  return p
}

async function myPermissions() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('user_roles')
    .select('roles(role_permissions(permissions(action)))')
    .eq('user_id', user.id)
  const s = new Set()
  for (const ur of data ?? [])
    for (const rp of ur.roles?.role_permissions ?? [])
      if (rp.permissions?.action) s.add(rp.permissions.action)
  return [...s]
}

let sessionId
let memberId

beforeAll(async () => {
  const { data } = await asMember()
  memberId = data.user.id
  await asGuest()
})

afterAll(async () => {
  try {
    await asAdmin()
    if (sessionId) await deleteSession(sessionId)
  } catch {
    /* best-effort cleanup */
  }
  await supabase.auth.signOut()
})

describe('인증 & RBAC', () => {
  it('admin 로그인 → draw:create / member:manage 보유', async () => {
    const { error } = await asAdmin()
    expect(error).toBeNull()
    const perms = await myPermissions()
    expect(perms).toEqual(expect.arrayContaining(['draw:create', 'draw:update', 'member:manage', 'score:write']))
  })

  it('member 로그인 → score:write 있고 draw:create 없음', async () => {
    await asMember()
    const perms = await myPermissions()
    expect(perms).toContain('score:write')
    expect(perms).toContain('stats:read')
    expect(perms).not.toContain('draw:create')
  })
})

describe('대진 저장 RLS', () => {
  it('member 는 대진을 저장할 수 없다 (RLS 차단)', async () => {
    await asMember()
    const draw = generateDraw({ participants: roster(6, 2), date: '2026-07-01', seed: 1 })
    await expect(saveDraw(draw, memberId)).rejects.toBeTruthy()
  })

  it('admin 은 대진을 저장하고 다시 조회할 수 있다', async () => {
    const { data } = await asAdmin()
    const draw = generateDraw({ participants: roster(6, 2), date: '2026-07-01', seed: 7 })
    sessionId = await saveDraw(draw, data.user.id)
    expect(sessionId).toBeTruthy()

    const snapshot = await loadDraw(sessionId)
    expect(snapshot.slots.length).toBe(draw.slots.length)
    expect(snapshot.participants.length).toBe(8)

    const matches = await loadSessionMatches(sessionId)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('게스트(비로그인)도 저장된 대진을 읽을 수 있다', async () => {
    await asGuest()
    const snapshot = await loadDraw(sessionId)
    expect(snapshot).toBeTruthy()
    expect(snapshot.slots.length).toBeGreaterThan(0)
  })
})

describe('스코어 입력 → 통계 자동 갱신', () => {
  let firstMatch
  it('admin 이 첫 경기에 스코어 입력 → 승자 계산', async () => {
    await asAdmin()
    const matches = await loadSessionMatches(sessionId)
    firstMatch = matches[0]
    const winner = await saveScore(firstMatch.id, 6, 3, null)
    expect(winner).toBe('A')
    const after = await loadSessionMatches(sessionId)
    const m = after.find((x) => x.id === firstMatch.id)
    expect(m.score.winner).toBe('A')
  })

  it('summary_stats 에 이긴 팀/진 팀이 집계된다', async () => {
    const stats = await loadAllStats()
    const winners = firstMatch.team_a
    const losers = firstMatch.team_b
    const w = stats.find((s) => s.player_name === winners[0])
    const l = stats.find((s) => s.player_name === losers[0])
    expect(w?.wins).toBeGreaterThanOrEqual(1)
    expect(l?.losses).toBeGreaterThanOrEqual(1)
  })

  it('페어 통계(get_pair_stats)에 같은 팀 페어가 나온다', async () => {
    const pairs = await loadPairStats(1)
    const winPair = firstMatch.team_a.slice().sort()
    const found = pairs.find(
      (p) => [p.player_a, p.player_b].sort().join('|') === winPair.join('|'),
    )
    expect(found).toBeTruthy()
    expect(found.wins).toBeGreaterThanOrEqual(1)
  })
})

describe('대진 수정 (admin)', () => {
  it('선수 자리 교체 (수동 패치) — saveSessionEdits', async () => {
    await asAdmin()
    const snapshot = await loadDraw(sessionId)
    const matches = await loadSessionMatches(sessionId)
    const target = matches[0]
    const slotNo = target.slot_no
    const court = target.court
    const swapped = [target.team_a[1], target.team_a[0]] // teamA 순서 교체
    const updated = {
      ...snapshot,
      slots: snapshot.slots.map((s) =>
        s.slotNo === slotNo
          ? { ...s, courts: { ...s.courts, [court]: { ...s.courts[court], teamA: swapped } } }
          : s,
      ),
    }
    await saveSessionEdits(sessionId, updated, [
      { matchId: target.id, teamA: swapped, teamB: target.team_b },
    ])
    const after = await loadSessionMatches(sessionId)
    const m = after.find((x) => x.id === target.id)
    expect(m.team_a).toEqual(swapped)
  })

  it('전체 다시 짜기 (재생성) — 새 경기 생성', async () => {
    await asAdmin()
    const snapshot = await loadDraw(sessionId)
    const fresh = generateDraw({
      participants: snapshot.participants,
      date: snapshot.date,
      seed: 999,
    })
    await regenerateSession(sessionId, fresh)
    const matches = await loadSessionMatches(sessionId)
    expect(matches.length).toBeGreaterThan(0)
    // 재생성 후 스코어는 초기화(매치가 새로 생성됨)
    expect(matches.every((m) => !m.score)).toBe(true)
  })
})

describe('관리자 기능', () => {
  it('회원 목록 + 역할 조회', async () => {
    await asAdmin()
    const users = await loadUsersWithRoles()
    expect(users.length).toBeGreaterThanOrEqual(2)
    expect(users.find((u) => u.roles.includes('admin'))).toBeTruthy()
  })

  it('회원 역할 부여/회수 (member 에 guest 역할 토글)', async () => {
    await asAdmin()
    await addRole(memberId, 'guest')
    let users = await loadUsersWithRoles()
    expect(users.find((u) => u.id === memberId).roles).toContain('guest')
    await removeRole(memberId, 'guest')
    users = await loadUsersWithRoles()
    expect(users.find((u) => u.id === memberId).roles).not.toContain('guest')
  })

  it('회원 활성/비활성 토글', async () => {
    await asAdmin()
    await setUserActive(memberId, false)
    let users = await loadUsersWithRoles()
    expect(users.find((u) => u.id === memberId).is_active).toBe(false)
    await setUserActive(memberId, true) // 복구
    users = await loadUsersWithRoles()
    expect(users.find((u) => u.id === memberId).is_active).toBe(true)
  })

  it('member 는 클럽원 목록(loadMembers)에서 활성 회원을 본다', async () => {
    const members = await loadMembers()
    expect(Array.isArray(members)).toBe(true)
    expect(members.every((m) => m.is_active)).toBe(true)
  })
})
