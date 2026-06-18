-- =====================================================================
-- 0008_fix_recompute_stats.sql
-- 0007 의 recompute_player_stats 버그 수정.
-- 원인: WITH judged CTE 를 분리된 3개 문장에서 재사용 → CTE 는 한 문장에서만
--       유효하므로 2·3번째에서 "relation judged does not exist" (42P01) 발생,
--       트리거가 깨져 scores upsert 까지 실패(404).
-- 수정: 모든 집계를 한 SELECT 문으로 합치고 by_type/recent_10 은 CTE 를
--       참조하는 스칼라 서브쿼리로 계산한다.
-- =====================================================================

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
    count(*) filter (where result = 'draw'),
    (
      select coalesce(jsonb_object_agg(match_type, stat), '{}'::jsonb)
      from (
        select match_type, jsonb_build_object(
          'games',  count(*),
          'wins',   count(*) filter (where result = 'win'),
          'losses', count(*) filter (where result = 'loss'),
          'draws',  count(*) filter (where result = 'draw')
        ) as stat
        from judged group by match_type
      ) t
    ),
    (
      select coalesce(
        jsonb_agg(jsonb_build_object('result', result, 'type', match_type) order by created_at desc),
        '[]'::jsonb)
      from (select result, match_type, created_at from judged order by created_at desc limit 10) r
    )
  into v_total, v_wins, v_losses, v_draws, v_by_type, v_recent
  from judged;

  v_rate := case when coalesce(v_total,0) > 0 then round((v_wins::numeric / v_total), 4) else 0 end;

  insert into summary_stats(player_name, total_games, wins, losses, draws, win_rate, by_type, recent_10, updated_at)
  values (pname, coalesce(v_total,0), coalesce(v_wins,0), coalesce(v_losses,0), coalesce(v_draws,0),
          v_rate, coalesce(v_by_type,'{}'::jsonb), coalesce(v_recent,'[]'::jsonb), now())
  on conflict (player_name) do update set
    total_games = excluded.total_games, wins = excluded.wins, losses = excluded.losses,
    draws = excluded.draws, win_rate = excluded.win_rate, by_type = excluded.by_type,
    recent_10 = excluded.recent_10, updated_at = now();
end $$;
