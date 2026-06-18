-- =====================================================================
-- 0009_pair_stats.sql
-- 페어 궁합 분석: 같은 팀이었던 2인 조합의 승률 집계 (RPC 함수).
-- matches.team_a / team_b (각 2명) + scores.winner 로 계산.
-- min_games 로 최소 경기 수 필터 (소표본 노이즈 제거).
-- =====================================================================

create or replace function public.get_pair_stats(min_games int default 1)
returns table (
  player_a text,
  player_b text,
  games    int,
  wins     int,
  losses   int,
  draws    int,
  win_rate float
)
language sql stable security definer set search_path = public as $$
  with team_results as (
    -- team_a 결과
    select
      (select array_agg(p order by p) from unnest(m.team_a) p) as pair,
      case when s.winner = 'A' then 'win'
           when s.winner = 'draw' then 'draw'
           else 'loss' end as result
    from matches m
    join scores s on s.match_id = m.id
    where coalesce(array_length(m.team_a, 1), 0) = 2
    union all
    -- team_b 결과
    select
      (select array_agg(p order by p) from unnest(m.team_b) p),
      case when s.winner = 'B' then 'win'
           when s.winner = 'draw' then 'draw'
           else 'loss' end
    from matches m
    join scores s on s.match_id = m.id
    where coalesce(array_length(m.team_b, 1), 0) = 2
  )
  select
    pair[1],
    pair[2],
    count(*)::int,
    count(*) filter (where result = 'win')::int,
    count(*) filter (where result = 'loss')::int,
    count(*) filter (where result = 'draw')::int,
    round(count(*) filter (where result = 'win')::numeric / count(*), 4)::float
  from team_results
  group by pair
  having count(*) >= min_games
  order by round(count(*) filter (where result = 'win')::numeric / count(*), 4) desc,
           count(*) desc;
$$;

grant execute on function public.get_pair_stats(int) to anon, authenticated;
