-- =====================================================================
-- 0006_scores_constraints.sql
-- 스코어 입력 지원:
--   (1) 경기당 스코어 1건 보장 (upsert 가능하도록 unique)
--   (2) 로그인 사용자의 스코어 수정(UPDATE) 정책 (0004 엔 insert 만 있었음)
-- =====================================================================

-- (1) match_id 유니크 — 한 경기에 점수 한 줄. upsert(on_conflict=match_id) 용.
do $$ begin
  alter table scores add constraint scores_match_unique unique (match_id);
exception when duplicate_object then null; end $$;

-- (2) 로그인 사용자 스코어 수정 허용
drop policy if exists "scores_update" on scores;
create policy "scores_update" on scores for update using (auth.uid() is not null);
