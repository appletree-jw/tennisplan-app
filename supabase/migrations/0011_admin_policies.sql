-- =====================================================================
-- 0011_admin_policies.sql
-- 권한 기반 정책: 대진 생성/수정/삭제 및 회원 관리는 admin 전용.
--   - is_admin(): 현재 사용자가 admin 역할인지 (security definer 라 user_roles RLS 우회 → 재귀 없음)
--   - sessions/matches: 쓰기/수정/삭제 admin 전용 (읽기는 공개 유지)
--   - users: admin 이 활성/비활성 수정 가능
--   - user_roles: admin 이 역할 부여/회수/조회 가능
-- (스코어 입력은 score:write 회원도 가능하도록 기존 정책 유지)
-- =====================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.name = 'admin'
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 대진 세션: 쓰기/수정/삭제 admin 전용 (읽기 공개는 0004 유지)
drop policy if exists "sessions_write" on sessions;
create policy "sessions_write"  on sessions for insert with check (is_admin());
drop policy if exists "sessions_update" on sessions;
create policy "sessions_update" on sessions for update using (is_admin());
drop policy if exists "sessions_delete" on sessions;
create policy "sessions_delete" on sessions for delete using (is_admin());

-- 경기: 쓰기/수정/삭제 admin 전용
drop policy if exists "matches_write" on matches;
create policy "matches_write"  on matches for insert with check (is_admin());
drop policy if exists "matches_update" on matches;
create policy "matches_update" on matches for update using (is_admin());
drop policy if exists "matches_delete" on matches;
create policy "matches_delete" on matches for delete using (is_admin());

-- 회원 프로필: admin 이 활성/비활성 등 수정 (본인 수정 정책 users_self_update 는 유지)
drop policy if exists "users_admin_update" on users;
create policy "users_admin_update" on users for update using (is_admin());

-- 역할 매핑: admin 이 전체 조회 + 부여/회수 (본인 조회 user_roles_self_read 는 유지)
drop policy if exists "user_roles_admin_read" on user_roles;
create policy "user_roles_admin_read"   on user_roles for select using (is_admin());
drop policy if exists "user_roles_admin_insert" on user_roles;
create policy "user_roles_admin_insert" on user_roles for insert with check (is_admin());
drop policy if exists "user_roles_admin_delete" on user_roles;
create policy "user_roles_admin_delete" on user_roles for delete using (is_admin());
