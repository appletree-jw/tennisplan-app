# 세션 기록 (대화 백업)

Claude Code 작업 세션의 원본 대화 기록(`.jsonl`)입니다. 다음 세션에서 맥락을 복원하거나 의사결정 경위를 추적할 때 참고하세요.

| 파일 | 날짜 | 내용 |
|------|------|------|
| `2026-06-13_session_4b237208.jsonl` | 2026-06-13 | 초기 환경 구성 · DB 마이그레이션 SQL 작성 (이전 세션, `cd /Users/user` 에서 진행) |
| `2026-06-14_session_344bd922.jsonl` | 2026-06-14 | 인증방식 결정(Supabase Auth) · 대진 생성 엔진 + UI 구현 |

## 보는 법
- 각 줄이 하나의 메시지(JSON). `jq` 로 보기:
  ```bash
  jq -r 'select(.message.role=="user" or .message.role=="assistant") | .message.role' 2026-06-14_session_344bd922.jsonl | head
  ```
- 읽기 쉬운 요약은 프로젝트 루트 `HANDOFF.md` 참고.

> ⚠️ 원본 대화 전문이라 용량이 큽니다. Git에 커밋할지는 선택 — 민감정보가 없다면 커밋해도 무방하나, 저장소를 가볍게 유지하려면 `.gitignore` 에 `docs/sessions/*.jsonl` 추가를 고려하세요.
