# 🎾 테니스 클럽 관리 앱 — TODO 리스트

> PLAN.md 분석 기반 (마지막 업데이트: 2026-06-13)
> 범례: ✅ 완료 · 🟡 진행 중 · ⬜ 예정

---

## Step 1. 환경 설정 ✅
- [x] Git 설정
- [x] 로컬 MCP 환경 구성
- [x] Supabase 프로젝트 생성
- [x] React 앱 초기화 (CRA 또는 Vite)

## Step 2. DB 마이그레이션 ✅ (실행 완료, 2026-06-14)
> 프로젝트 `pkqqqklwzmwluiexfdhn` 에 0001~0004 실행 완료. 테이블 9개 + RLS + 트리거 + 시드 검증됨.

**인증/권한 테이블** — `0001_auth_rbac.sql` ✅ 작성
- [x] `users` (id, username, password, name, gender, is_active, created_at)
- [x] `roles` (id, name, description)
- [x] `user_roles` (user_id, role_id, granted_at) — 다대다 매핑
- [x] `permissions` (id, action)
- [x] `role_permissions` (role_id, permission_id)

**경기 관련 테이블** — `0002_match_tables.sql` ✅ 작성
- [x] `sessions` (id, date, total_slots, created_by, created_at)
- [x] `matches` (id, session_id, slot_no, court, match_type, team_a[], team_b[], created_at)
- [x] `scores` (id, match_id, score_a, score_b, winner, recorded_by)
- [x] `summary_stats` (user_id, total_games, wins, losses, win_rate, by_type(jsonb), recent_10(jsonb), updated_at)
- [x] 권한 데이터 시드 — `0003_seed_roles_permissions.sql` ✅ 작성

**남은 작업**
- [x] Supabase 프로젝트 키를 `.env.local` 에 설정 (publishable 키)
- [x] 마이그레이션 실제 실행 (대시보드 SQL Editor — 0001~0004)
- [x] 인증 방식 결정 → **Supabase Auth** (2026-06-14). `users`는 프로필 전용, `password` 컬럼 제거
- [x] RLS + 프로필/역할 자동생성 트리거 (`0004_rls_and_auth_trigger.sql`)

## Step 3. 인증 구현 ✅ (백엔드 검증 완료, 2026-06-14)
- [x] 내 정보 수정 (`/profile`, `ProfilePage`, `profileService`) — 이름·성별·비밀번호 변경
      (본인만, RLS users_self_update + auth.updateUser). 네비 "○○님" 클릭 진입. E2E 검증.
- [x] 회원가입 (아이디·비번·이름·성별) — `src/pages/SignupPage.jsx`
- [x] 로그인 → 세션 (Supabase Auth) — `src/pages/LoginPage.jsx`
- [x] 권한 컨텍스트 (RBAC: user_roles→role_permissions 조회, guest=draw:read) — `src/lib/auth.jsx`
- [x] 라우팅 (`/`, `/login`, `/signup`) + 네비바 로그인 상태
- [x] 프로필/기본역할은 DB 트리거가 생성 (클라 insert 제거 — 보안)
- [x] **E2E 검증**: 가입→로그인→프로필 자동생성→member 역할/권한 조회 전부 확인
      - 합성이메일 도메인 `tennisplan.com` (`.local`/`.app` 은 Supabase 거부)
      - Supabase Auth: Confirm email OFF, Allow signup ON
- [x] 권한별 게이팅 + 첫 admin 지정 (`admin` 계정, `0010`) + admin 전용 RLS (`0011`, is_admin())
      - 대진 생성/수정/삭제 admin 전용, 스코어=member, 조회=guest. E2E 검증(admin 201 / member 403).
- [x] Admin 페이지 (`/admin`) — 회원 역할 관리·활성/비활성·**성별 지정**·**회원 삭제**·대진표 삭제 (`0012`)
      - 성별 지정 → 성별 미지정 회원(예: admin 계정)이 대진 참가자 목록에 노출됨
      - 회원 삭제는 프로필만 (auth 계정은 Admin API 필요). 본인 삭제 방지.
- [x] **대진표 수정** (admin 전용, `SessionDetailPage` 수정 모드 = 명단 편집 + 최소 패치)
      - 참석자 명단 편집(클럽원/게스트 추가, 제외) + 경기별 드롭다운 배치 + 휴식 자동 재계산
      - 변경 저장: 바뀐 경기만 in-place 업데이트(스코어 유지), 슬롯 중복 검증. RLS 검증(admin만).
      - 옛 세션(participants 미저장)은 스냅샷에서 이름 추출해 동작. 전체 재생성은 미채택(최소패치 선택).
- [ ] 테스트 계정/데이터 정리 (`testuser1`, 테스트 세션들)
- [ ] 브라우저에서 admin 로그인 → 생성/관리 UI 클릭 확인

## Step 4. 대진표 기능 🟡 (우선순위 1 — 진행 중)
- [x] 참석자 선택 UI (`src/App.jsx`) — 이름·성별·게스트 입력, 인원 카운트
- [x] 대진 생성 (DRAW_RULES.md 룰셋 → `src/lib/drawGenerator.js` 휴리스틱 엔진)
      - 하드룰: 세트균등(±1)·슬롯중복금지·연속휴식금지(≤2)·성비 유형배분
      - 소프트룰 가중치(페어40/세트25/휴식20/코트15) + 시드 기반 5000회 반복 최적해
      - 결과 테이블 + 유형별 색상 + 특이사항(경고) 출력
      - ✅ **테스트 15종 통과** (`drawGenerator.test.js`, vitest — `npm test`)
- [x] 대진표 **이미지** 출력 (§11) — `html-to-image`로 PNG 다운로드, 다크 테마 캡처
- [x] 대진표 저장 + 공유 URL 생성 (우선순위 3, guest 접근용)
      - `sessions.draw_json` 스냅샷 + 정규화 `matches` 저장 (`0005`, `src/lib/drawService.js`)
      - `/draw/:id` 읽기전용 공유 페이지 (`SharedDrawPage`), 결과 렌더 공용화 (`components/DrawResult.jsx`)
      - ✅ **E2E 검증**: 로그인 저장(RLS 쓰기) → anon 공유 조회(RLS 읽기) 통과

> UI 다크모드 적용 완료 (`index.css`·`App.css`). **Step 4 전체 완료.**

## Step 5. 스코어 입력 ✅ (E2E 검증 완료, 2026-06-14)
- [x] 경기별 스코어 입력 UI — **대진표 상세와 통합** (`src/pages/SessionDetailPage.jsx`, `/draw/:id`)
      - 대진표 보면서 경기 칸마다 인라인 점수 입력 → upsert(`scores`), 승자 자동계산
      - 권한 분기: score:write 는 입력칸, 게스트는 읽기전용
      - `scoreService.js`, 마이그레이션 `0006`(match_id unique + update 정책)
      - `DrawResult` 에 renderMatchExtra 슬롯 추가로 생성/상세 렌더 공용화
- [x] 입력 시 `summary_stats` 자동 갱신 (DB 트리거, **이름 기준** — 게스트 포함)
      - `0007`(name 기준 재정의 + recompute 함수 + 트리거), `0008`(함수 CTE 버그 수정)
      - 검증: 스코어 입력 → 트리거 → 선수별 승/패/승률/유형별/최근10 집계 확인. 동명이인 미구분.

## Step 6. 통계/분석 🟡 (우선순위 5~6)
- [x] 개인 승률 대시보드 (`/stats`, `StatsPage.jsx`, `statsService.js`)
      - summary_stats 읽어 순위/경기/승/패/무/승률/유형별/최근10 표시. stats:read 게이팅.
- [x] 페어 궁합(궁합 승률) 분석 — 같은 팀 2인 조합 승률 (RPC `get_pair_stats`, `0009`)
      - 통계 화면 "개인 승률 / 페어 궁합" 탭 + 최소경기수 필터. E2E 검증 완료.
      - ※ 엔진 반영(잘 맞는 페어 자동 편성)은 데이터 축적 후 결정 (페어중복최소화와 트레이드오프)
- [ ] 능력치 등급 산출 — 승률·경기수 기반 등급
- [ ] 능력치 기반 대진 밸런싱 (우선순위 6) — drawGenerator 에 능력치 가중 추가

---

## 🧪 테스트
- [x] 단위 테스트 — 대진 엔진 룰 16종 (`drawGenerator.test.js`, `npm test`)
- [x] 통합/관통 테스트 — 실제 Supabase 대상 14종 (`app.integration.test.js`, `npm run test:integration`)
      - 인증·RBAC·RLS(member 차단)·대진 저장/조회·게스트 읽기·스코어→통계 트리거·
        페어통계·대진수정(수동/재생성)·관리자(역할/활성/삭제) 전 흐름 검증
      - 🐞 발견·수정: scores unique(0006) 이후 PostgREST to-one 반환 → 저장된 스코어
        재조회 시 표시 안 되던 버그 (`scoreService.loadSessionMatches`) 수정
- [x] UI/UX E2E — Playwright 6종 (`e2e/ui.spec.js`, `npm run test:e2e`)
      - 게스트/회원/관리자 랜딩·네비 게이팅, 대진 생성 렌더, 통계 탭, 모바일 가로오버플로우
- [x] 디자인 고도화(다크 유지) — 그림자·간격·타이포·테이블 hover, **모바일 반응형**(네비 wrap,
      대진표 가로스크롤), **비관리자 홈 랜딩**(막다른 길 → 목록/통계·로그인 안내)
- [ ] (남은 UX) 저장/수정 후 토스트 피드백, 목록 검색/정렬 등

## 📌 별도 챙길 항목 (PLAN.md 분석 시 발견)
- [ ] **PLAN.md → 정식 마크다운으로 변환** — 현재 파일은 `.md` 확장자지만 실제로는 Word(.docx) 바이너리. Claude가 토큰 절약하며 읽기 어려움. 순수 텍스트 `.md`로 다시 저장 권장.
- [ ] **`DB_SCHEMA.md` 파일 생성** — PLAN.md의 협업 방식(§8)에서 `DB_SCHEMA.md`를 참조하지만 폴더에 아직 없음. DB 스키마를 별도 파일로 분리.
- [ ] 배포 환경 확정 (Vercel vs GitHub Pages — Vercel 권장: SPA/서버리스 지원)
- [x] 비밀번호 인증 방식 일원화 → **Supabase Auth** 채택 (2026-06-14). `password` 컬럼 제거, `users`는 `auth.users` 1:1 프로필.
