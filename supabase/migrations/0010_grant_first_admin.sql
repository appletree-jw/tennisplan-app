-- =====================================================================
-- 0010_grant_first_admin.sql
-- 최초 관리자 지정: 'admin' 계정에 admin 역할 부여.
-- (계정 자체는 Auth API 회원가입으로 먼저 생성됨 / member 역할은 트리거가 자동부여)
-- 다른 사람을 admin 으로 만들려면 username 만 바꿔서 재실행.
-- =====================================================================

insert into user_roles (user_id, role_id)
select u.id, r.id
from users u cross join roles r
where u.username = 'admin' and r.name = 'admin'
on conflict do nothing;
