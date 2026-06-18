-- =====================================================================
-- 0007_name_based_summary_stats.sql
-- 통계 집계를 "이름(텍스트)" 기준으로 재설계 (게스트 포함). 결정 2026-06-14.
--   (1) summary_stats 를 player_name PK 로 재정의
--   (2) recompute_player_stats(pname): 한 선수 통계 재계산 함수
--   (3) scores 변경 시 관련 선수 통계 자동 갱신 트리거
-- 동명이인은 구분하지 않는다(이름이 곧 식별자).
-- =====================================================================

-- (1) 재정의 -------------------------------------------------------------
drop table if exists summary_stats cascade;
create table summary_stats (
  player_name  text primary key,
  total_games  int   not null default 0,
  wins         int   not null default 0,
  losses       int   not null default 0,
  draws        int   not null default 0,
  win_rate     float not null default 0,         -- 0~1
  by_type      jsonb not null default '{}',      -- 경기유형별 {games,wins,losses,draws}
  recent_10    jsonb not null default '[]',      -- 최근 10경기 [{result,type}]
  updated_at   timestamptz not null default now()
);
alter table summary_stats enable row level security;
drop policy if exists "summary_read" on summary_stats;
create policy "summary_read" on summary_stats for select using (true);

-- (2) 한 선수 통계 재계산 ------------------------------------------------
create or replace function public.recompute_player_stats(pname text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total int; v_wins int; v_losses int; v_draws int; v_rate float;
  v_by_type jsonb; v_recent jsonb;
begin
  with judged as (
    select
      m.match_type,
      m.created_at,
      case
        when s.winner = 'draw' then 'draw'
        when (pname = any(m.team_a) and s.winner = 'A')
          or (pname = any(m.team_b) and s.winner = 'B') then 'win'
        else 'loss'
      end as result
    from matches m
    join scores s on s.match_id = m.id
    where pname = any(m.team_a) or pname = any(m.team_b)
  )
  select
    count(*),
    count(*) filter (where result = 'win'),
    count(*) filter (where result = 'loss'),
    count(*) filter (where result = 'draw')
  into v_total, v_wins, v_losses, v_draws
  from judged;

  v_rate := case when v_total > 0 then round((v_wins::numeric / v_total), 4) else 0 end;

  select coalesce(jsonb_object_agg(match_type, stat), '{}'::jsonb) into v_by_type from (
    select match_type, jsonb_build_object(
      'games',  count(*),
      'wins',   count(*) filter (where result = 'win'),
      'losses', count(*) filter (where result = 'loss'),
      'draws',  count(*) filter (where result = 'draw')
    ) as stat
    from judged group by match_type
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('result', result, 'type', match_type)), '[]'::jsonb)
    into v_recent from (
    select result, match_type, created_at from judged order by created_at desc limit 10
  ) r;

  insert into summary_stats(player_name, total_games, wins, losses, draws, win_rate, by_type, recent_10, updated_at)
  values (pname, coalesce(v_total,0), coalesce(v_wins,0), coalesce(v_losses,0), coalesce(v_draws,0),
          coalesce(v_rate,0), coalesce(v_by_type,'{}'::jsonb), coalesce(v_recent,'[]'::jsonb), now())
  on conflict (player_name) do update set
    total_games = excluded.total_games, wins = excluded.wins, losses = excluded.losses,
    draws = excluded.draws, win_rate = excluded.win_rate, by_type = excluded.by_type,
    recent_10 = excluded.recent_10, updated_at = now();
end $$;

-- (3) 스코어 변경 트리거 -------------------------------------------------
create or replace function public.on_score_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text;
  team  text[];
begin
  select team_a || team_b into team from matches where id = new.match_id;
  if team is not null then
    foreach pname in array team loop
      perform recompute_player_stats(pname);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_score_change on scores;
create trigger trg_score_change
  after insert or update on scores
  for each row execute function public.on_score_change();
