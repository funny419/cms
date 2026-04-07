## 보안 이슈 추적

**최종 업데이트:** 2026-04-07
**검토자:** security
**참조:** planner 취합 보고 (전 팀원 의견)

---

## 이슈 현황

| 순위 | # | 이슈 | 심각도 | 복잡도 | 상태 | 담당 |
|------|---|------|--------|--------|------|------|
| 1 | #1 | 이메일 공개 노출 (`GET /api/auth/users/:username` 응답에 email 포함) | MEDIUM | 간단 | 완료 (commit bd640c4, 2026-04-07) | backend + frontend + writer |
| 2 | #2 | 댓글 승인 권한 과다 (`approve_comment` editor도 가능, API 스펙은 admin 전용) | MEDIUM | 간단 | 완료 (commit bd640c4, 2026-04-07) | backend + frontend + writer |
| 3 | #3 | Wizard `/migrate` 완료 후 미차단 (프로덕션 DB 재마이그레이션 위험) | MEDIUM | 간단 | 완료 (commit bd640c4, 2026-04-07) | backend + frontend + writer |
| 4 | #8 | 파일 업로드 크기 제한 없음 (DoS 위험) | LOW→P1 | 간단 | 완료 (commit 13dce39+bd640c4, 2026-04-07) | backend + infra |
| 5 | #4 | 파일 업로드 MIME magic bytes 미검증 | MEDIUM | 보통 | 완료 (commit 31c3cbf, 2026-04-07) | backend + frontend + writer |
| 6 | #5 | Rate Limiting 없음 (로그인 브루트포스 노출) | LOW | 보통 | 완료 (commit 31c3cbf, 2026-04-07) | backend (Flask-Limiter) |
| 7 | #7 | X-Forwarded-For 헤더 조작 가능 (visit_logs 통계 오염) | LOW | 간단 | 완료 (commit 459b7b3, 2026-04-07) | backend |
| 8 | #9 | `GET /api/media` editor 전체 미디어 조회 가능 | LOW→P1 | 간단 | 완료 (commit bd640c4, 2026-04-07) | backend |
| 9 | #6 | JWT 블랙리스트 없음 | LOW | 복잡 | 스팩아웃 확정 (2026-04-07) | — |

---

## P1 — 즉시 처리 (#1~#3, #8, #9)

수정 내용:
- **#1** `auth.py` `get_user_profile()` — `to_dict()` 응답에서 `email` 제거 (비로그인 접근 시)
- **#2** `comments.py` `approve_comment()` — `@roles_required("admin")` 단독으로 수정
- **#3** `wizard_phase2.py` `/migrate` — `_wizard_completed()` 체크 추가
- **#8** `app.py` — `MAX_CONTENT_LENGTH` 설정 + Nginx `client_max_body_size`
- **#9** `GET /api/media` — **정책 확정**: admin = 전체 조회, editor = 본인 업로드(`uploaded_by == 현재 유저`)만 조회. `media.py` 쿼리에 권한 분기 추가 (P3→P1 격상)

## P2 — 단기 처리 (#4, #5) ✅ 완료 (commit 31c3cbf, 2026-04-07)

- **#4** `python-magic` 도입, `media.py` magic bytes 검증 추가
- **#5** Flask-Limiter 적용 — `POST /api/auth/login` 10 per minute 제한

## P3 — 중기 처리 (#7) ✅ 완료 (commit 459b7b3, 2026-04-07)

- **#7** `get_client_ip()` 헬퍼 추가 — X-Real-IP 우선 사용, Nginx `real_ip_header` 설정은 기존에 이미 적용되어 있었음

## P4 — 스팩아웃 (#6)

- **#6** JWT 블랙리스트 — **스팩아웃 확정 (2026-04-07)**. Redis 없이 Gunicorn 멀티워커 간 공유 불가, 전 팀원 동의

---

## 미결정 사항

> 모든 미결정 사항이 2026-04-07 확정 완료됨.

| # | 결정 내용 | 확정일 |
|---|---------|--------|
| #5 | Flask-Limiter (backend 레이어) 확정, P2 진행 예정 | 2026-04-07 |
| #6 | 스팩아웃 확정 — Redis 없이 멀티워커 공유 불가 | 2026-04-07 |
| #9 | admin=전체 조회 / editor=본인 업로드만, P3→P1 격상 | 2026-04-07 |
