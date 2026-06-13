-- =====================================================================
-- 0002_match_tables.sql
-- 경기 관련 테이블
-- PLAN.md §4 "경기 관련 테이블" 기준
-- =====================================================================

-- 코트 / 경기유형 / 승자 enum
do $$ begin
  create type court_enum as enum ('3', '4');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_type_enum as enum ('혼복', '여복', '남복', '잡복');
exception when duplicate_object then null; end $$;

do $$ begin
  create type winner_enum as enum ('A', 'B', 'draw');
exception when duplicate_object then null; end $$;

-- 대진 세션 (날짜별)
create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  date         date not null,
  total_slots  int,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- 슬롯별 경기
create table if not exists matches (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  slot_no      int not null,                     -- 슬롯 번호
  court        court_enum,
  match_type   match_type_enum,
  team_a       text[] not null default '{}',     -- 참가자 이름 배열
  team_b       text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- 스코어
create table if not exists scores (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  score_a      int,
  score_b      int,
  winner       winner_enum,
  recorded_by  uuid references users(id) on delete set null
);

-- 집계 SUMMARY (Claude가 읽는 토큰 절약용 데이터 / PLAN.md §5)
create table if not exists summary_stats (
  user_id      uuid primary key references users(id) on delete cascade,
  total_games  int not null default 0,
  wins         int not null default 0,
  losses       int not null default 0,
  win_rate     float not null default 0,
  by_type      jsonb not null default '{}',      -- 경기유형별 승률
  recent_10    jsonb not null default '[]',      -- 최근 10경기
  updated_at   timestamptz not null default now()
);

create index if not exists idx_matches_session on matches(session_id);
create index if not exists idx_scores_match on scores(match_id);
create index if not exists idx_sessions_date on sessions(date);
