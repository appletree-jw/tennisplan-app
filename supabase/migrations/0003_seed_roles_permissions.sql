-- =====================================================================
-- 0003_seed_roles_permissions.sql
-- 역할 / 권한 기본 데이터 시드
-- PLAN.md §3 "권한 구조(RBAC)" 의 Permission 매트릭스 기준
-- =====================================================================

-- 역할
insert into roles (name, description) values
  ('admin',  'Member이면서 Admin, 대진 관리 전담'),
  ('member', '정회원: 스코어 입력, 통계 조회'),
  ('guest',  '게스트: 대진표 URL 읽기만 (로그인 불필요)')
on conflict (name) do nothing;

-- 권한
insert into permissions (action) values
  ('draw:read'),
  ('draw:create'),
  ('draw:update'),
  ('score:write'),
  ('stats:read'),
  ('member:manage')
on conflict (action) do nothing;

-- 역할-권한 매핑
-- PLAN.md 매트릭스:
--                admin  member  guest
-- draw:read       ✓      ✓       ✓
-- draw:create     ✓      ✗       ✗
-- draw:update     ✓      ✗       ✗
-- score:write     ✓      ✓       ✗
-- stats:read      ✓      ✓       ✗
-- member:manage   ✓      ✗       ✗

-- admin: 전체 권한
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r cross join permissions p
where r.name = 'admin'
on conflict do nothing;

-- member: draw:read, score:write, stats:read
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r join permissions p
  on p.action in ('draw:read', 'score:write', 'stats:read')
where r.name = 'member'
on conflict do nothing;

-- guest: draw:read 만
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r join permissions p
  on p.action in ('draw:read')
where r.name = 'guest'
on conflict do nothing;
