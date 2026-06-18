-- =====================================================================
-- 0004_rls_and_auth_trigger.sql
-- (1) 역할/권한 재시드 (idempotent)
-- (2) 신규 가입 시 프로필 + 기본 member 역할 자동 생성 트리거
-- (3) RLS 활성화 + 접근 정책
--
-- 배경: 회원가입 때 클라이언트가 users/user_roles 에 직접 insert 하던 방식은
--       유저가 스스로 admin 을 부여할 수 있어 안전하지 않다. SECURITY DEFINER
--       트리거가 auth.users insert 시점에 프로필과 member 역할을 대신 생성한다.
-- =====================================================================

-- ───────────── (1) 재시드 (이미 있으면 무시) ─────────────
insert into roles (name, description) values
  ('admin',  'Member이면서 Admin, 대진 관리 전담'),
  ('member', '정회원: 스코어 입력, 통계 조회'),
  ('guest',  '게스트: 대진표 URL 읽기만 (로그인 불필요)')
on conflict (name) do nothing;

insert into permissions (action) values
  ('draw:read'), ('draw:create'), ('draw:update'),
  ('score:write'), ('stats:read'), ('member:manage')
on conflict (action) do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.name = 'admin' on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.action in ('draw:read', 'score:write', 'stats:read')
where r.name = 'member' on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.action in ('draw:read')
where r.name = 'guest' on conflict do nothing;

-- ───────────── (2) 프로필/기본역할 자동생성 트리거 ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  member_role_id int;
begin
  insert into public.users (id, username, name, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', '회원'),
    nullif(new.raw_user_meta_data->>'gender', '')::gender_enum
  )
  on conflict (id) do nothing;

  select id into member_role_id from public.roles where name = 'member';
  if member_role_id is not null then
    insert into public.user_roles (user_id, role_id)
    values (new.id, member_role_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── (3) RLS 활성화 + 정책 ─────────────
alter table users            enable row level security;
alter table roles            enable row level security;
alter table user_roles       enable row level security;
alter table permissions      enable row level security;
alter table role_permissions enable row level security;
alter table sessions         enable row level security;
alter table matches          enable row level security;
alter table scores           enable row level security;
alter table summary_stats    enable row level security;

-- RBAC 참조 테이블: 누구나 읽기 (권한 계산/게스트 기본권한에 필요)
drop policy if exists "roles_read" on roles;
create policy "roles_read" on roles for select using (true);
drop policy if exists "permissions_read" on permissions;
create policy "permissions_read" on permissions for select using (true);
drop policy if exists "role_permissions_read" on role_permissions;
create policy "role_permissions_read" on role_permissions for select using (true);

-- users 프로필: 읽기 공개(이름은 대진표에 노출되는 값), 본인만 수정/생성
drop policy if exists "users_read" on users;
create policy "users_read" on users for select using (true);
drop policy if exists "users_self_insert" on users;
create policy "users_self_insert" on users for insert with check (auth.uid() = id);
drop policy if exists "users_self_update" on users;
create policy "users_self_update" on users for update using (auth.uid() = id);

-- user_roles: 본인 것만 읽기 (생성은 트리거가 definer 권한으로 처리)
drop policy if exists "user_roles_self_read" on user_roles;
create policy "user_roles_self_read" on user_roles for select using (auth.uid() = user_id);

-- 대진/경기: 누구나 읽기(게스트 공유 URL), 로그인 사용자만 쓰기
drop policy if exists "sessions_read" on sessions;
create policy "sessions_read" on sessions for select using (true);
drop policy if exists "sessions_write" on sessions;
create policy "sessions_write" on sessions for insert with check (auth.uid() is not null);

drop policy if exists "matches_read" on matches;
create policy "matches_read" on matches for select using (true);
drop policy if exists "matches_write" on matches;
create policy "matches_write" on matches for insert with check (auth.uid() is not null);

drop policy if exists "scores_read" on scores;
create policy "scores_read" on scores for select using (true);
drop policy if exists "scores_write" on scores;
create policy "scores_write" on scores for insert with check (auth.uid() is not null);

drop policy if exists "summary_read" on summary_stats;
create policy "summary_read" on summary_stats for select using (true);
