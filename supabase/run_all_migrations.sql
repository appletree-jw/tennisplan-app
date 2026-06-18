-- =====================================================================
-- run_all_migrations.sql  (대시보드 SQL Editor 붙여넣기용 통합본)
-- 0001 + 0002 + 0003 을 순서대로 합친 것. 한 번에 실행하세요.
-- 원본: supabase/migrations/0001_auth_rbac.sql, 0002_match_tables.sql,
--       0003_seed_roles_permissions.sql
-- =====================================================================

-- ───────────────────────── 0001 인증/권한(RBAC) ─────────────────────────
do $$ begin
  create type gender_enum as enum ('M', 'F');
exception
  when duplicate_object then null;
end $$;

-- 클럽원 프로필 (인증은 Supabase Auth / auth.users 가 담당, 여긴 프로필 전용)
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    varchar unique not null,
  name        varchar not null,
  gender      gender_enum,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists roles (
  id          serial primary key,
  name        varchar unique not null,
  description varchar
);

create table if not exists user_roles (
  user_id     uuid not null references users(id) on delete cascade,
  role_id     int  not null references roles(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists permissions (
  id          serial primary key,
  action      varchar unique not null
);

create table if not exists role_permissions (
  role_id        int not null references roles(id) on delete cascade,
  permission_id  int not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists idx_user_roles_user on user_roles(user_id);
create index if not exists idx_role_permissions_role on role_permissions(role_id);

-- ───────────────────────── 0002 경기 관련 테이블 ─────────────────────────
do $$ begin
  create type court_enum as enum ('3', '4');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_type_enum as enum ('혼복', '여복', '남복', '잡복');
exception when duplicate_object then null; end $$;

do $$ begin
  create type winner_enum as enum ('A', 'B', 'draw');
exception when duplicate_object then null; end $$;

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  total_slots  int,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  slot_no      int not null,
  court        court_enum,
  match_type   match_type_enum,
  team_a       text[] not null default '{}',
  team_b       text[] not null default '{}',
  created_at   timestamptz not null default now()
);

create table if not exists scores (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  score_a      int,
  score_b      int,
  winner       winner_enum,
  recorded_by  uuid references users(id) on delete set null
);

create table if not exists summary_stats (
  user_id      uuid primary key references users(id) on delete cascade,
  total_games  int not null default 0,
  wins         int not null default 0,
  losses       int not null default 0,
  win_rate     float not null default 0,
  by_type      jsonb not null default '{}',
  recent_10    jsonb not null default '[]',
  updated_at   timestamptz not null default now()
);

create index if not exists idx_matches_session on matches(session_id);
create index if not exists idx_scores_match on scores(match_id);
create index if not exists idx_sessions_date on sessions(date);

-- ─────────────────── 0003 역할/권한 시드 (RBAC 매트릭스) ───────────────────
insert into roles (name, description) values
  ('admin',  'Member이면서 Admin, 대진 관리 전담'),
  ('member', '정회원: 스코어 입력, 통계 조회'),
  ('guest',  '게스트: 대진표 URL 읽기만 (로그인 불필요)')
on conflict (name) do nothing;

insert into permissions (action) values
  ('draw:read'), ('draw:create'), ('draw:update'),
  ('score:write'), ('stats:read'), ('member:manage')
on conflict (action) do nothing;

-- admin: 전체 권한
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p
where r.name = 'admin'
on conflict do nothing;

-- member: draw:read, score:write, stats:read
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.action in ('draw:read', 'score:write', 'stats:read')
where r.name = 'member'
on conflict do nothing;

-- guest: draw:read 만
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r join permissions p
  on p.action in ('draw:read')
where r.name = 'guest'
on conflict do nothing;
