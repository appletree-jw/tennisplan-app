-- =====================================================================
-- 0001_auth_rbac.sql
-- 인증/권한(RBAC) 테이블
-- PLAN.md §4 "인증/권한 테이블" 기준
-- =====================================================================

-- 성별 enum
do $$ begin
  create type gender_enum as enum ('M', 'F');
exception
  when duplicate_object then null;
end $$;

-- 클럽원 프로필
-- 인증 방식: Supabase Auth (auth.users) — 이 테이블은 프로필 전용.
-- id 는 auth.users.id 를 그대로 사용(1:1). 비밀번호/세션은 Supabase Auth 가 관리.
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    varchar unique not null,          -- 로그인/표시용 아이디
  name        varchar not null,                  -- 대진표 표시 이름
  gender      gender_enum,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 역할
create table if not exists roles (
  id          serial primary key,
  name        varchar unique not null,           -- 'admin', 'member', 'guest'
  description varchar
);

-- 유저-역할 매핑 (다대다)
create table if not exists user_roles (
  user_id     uuid not null references users(id) on delete cascade,
  role_id     int  not null references roles(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- 세부 권한
create table if not exists permissions (
  id          serial primary key,
  action      varchar unique not null            -- 'draw:create', 'score:write' 등
);

-- 역할-권한 매핑
create table if not exists role_permissions (
  role_id        int not null references roles(id) on delete cascade,
  permission_id  int not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists idx_user_roles_user on user_roles(user_id);
create index if not exists idx_role_permissions_role on role_permissions(role_id);
