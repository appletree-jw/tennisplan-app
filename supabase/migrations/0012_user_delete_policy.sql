-- =====================================================================
-- 0012_user_delete_policy.sql
-- 관리자가 회원(프로필) 삭제 가능하도록 RLS 추가.
-- (성별 수정은 0011 의 users_admin_update 정책으로 이미 가능)
-- 주의: public.users 행만 삭제됨. auth.users 계정 자체 삭제는 service_role/Admin API
--       필요(클라이언트 불가) — 삭제된 회원은 프로필·역할이 사라져 게스트 수준이 됨.
--       user_roles 는 FK on delete cascade 로 함께 정리됨.
-- =====================================================================

drop policy if exists "users_admin_delete" on users;
create policy "users_admin_delete" on users for delete using (is_admin());
