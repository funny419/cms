## 보안 이슈 추적

**최종 업데이트:** 2026-04-07
**검토자:** security
**참조:** planner 취합 보고 (전 팀원 의견)

---

## 이슈 현황

| 순위 | # | 이슈 | 심각도 | 복잡도 | 상태 | 담당 |
|------|---|------|--------|--------|------|------|
| 1 | #1 | 이메일 공개 노출 (`GET /api/auth/users/:username` 응답에 email 포함) | MEDIUM | 간단 | 미수정 | backend + frontend + writer |
| 2 | #2 | 댓글 승인 권한 과다 (`approve_comment` editor도 가능, API 스펙은 admin 전용) | MEDIUM | 간단 | 미수정 | backend + frontend + writer |
| 3 | #3 | Wizard `/migrate` 완료 후 미차단 (프로덕션 DB 재마이그레이션 위험) | MEDIUM | 간단 | 미수정 | backend + frontend + writer |
| 4 | #8 | 파일 업로드 크기 제한 없음 (DoS 위험) | LOW→P1 | 간단 | 미수정 | backend + infra |
| 5 | #4 | 파일 업로드 MIME magic bytes 미검증 | MEDIUM | 보통 | 미수정 | backend + frontend + writer |
| 6 | #5 | Rate Limiting 없음 (로그인 브루트포스 노출) | LOW | 보통 | 미수정 | backend 또는 infra (레이어 미결정) |
| 7 | #7 | X-Forwarded-For 헤더 조작 가능 (visit_logs 통계 오염) | LOW | 간단 | 미수정 | backend 또는 infra (미결정) |
| 8 | #9 | `GET /api/media` editor 전체 미디어 조회 가능 | LOW | 간단 | 미수정 | backend (설계 의도 확인 필요) |
| 9 | #6 | JWT 블랙리스트 없음 | LOW | 복잡 | 스팩아웃 검토 중 | — |

---

## P1 — 즉시 처리 (#1~#3, #8)

수정 내용:
- **#1** `auth.py` `get_user_profile()` — `to_dict()` 응답에서 `email` 제거 (비로그인 접근 시)
- **#2** `comments.py` `approve_comment()` — `@roles_required("admin")` 단독으로 수정
- **#3** `wizard_phase2.py` `/migrate` — `_wizard_completed()` 체크 추가
- **#8** `app.py` — `MAX_CONTENT_LENGTH` 설정 + Nginx `client_max_body_size`

## P2 — 단기 처리 (#4, #5)

- **#4** `python-magic` 또는 `imghdr` 도입, `media.py` magic bytes 검증 추가
- **#5** Rate Limiting — backend(Flask-Limiter) 또는 infra(Nginx limit_req_zone) **team-lead 결정 대기 중**

## P3 — 중기 처리 (#7, #9)

- **#7** IP 추출 로직 개선 또는 Nginx `real_ip_header` 설정
- **#9** `GET /api/media` — `uploaded_by` 필터 추가 여부 **team-lead 결정 대기 중**

## P4 — 장기/보류 (#6)

- **#6** JWT 블랙리스트 — Redis 없이 Gunicorn 멀티워커 간 공유 불가. **전 팀원 스팩아웃 권장, team-lead 확정 대기 중**

---

## 미결정 사항 (team-lead 결정 필요)

| # | 질문 |
|---|------|
| #5 | Rate Limiting 레이어: backend(Flask-Limiter) vs infra(Nginx)? |
| #6 | JWT 블랙리스트 스팩아웃 확정 여부? |
| #9 | `GET /api/media` editor 전체 조회 — 의도된 설계 vs 수정 대상? |
