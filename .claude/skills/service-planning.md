---
name: service-planning
description: 새 기능을 기획하거나 로드맵 Phase 작업을 시작할 때 사용. 요구사항 → 스펙 문서화 → 구현 범위 정의 흐름.
---

# Service Planning

## 1. 기획 전 현황 파악

먼저 아래를 확인한다:
- `.claude/rules/roadmap.md` — 현재 구현 현황 및 Phase 1~3 미구현 목록
- `docs/멀티유저블로그_UX기획_분석보고서.md` — UX/기능 기획 로드맵 상세
- GitHub Projects: https://github.com/users/funny419/projects/1

---

## 2. 기능 정의 질문

기획할 기능에 대해 아래를 정의한다:

### Who (누가 사용하는가?)
- `admin` / `editor` / 비로그인 방문자 / 전체

### What (무엇을 할 수 있는가?)
- 핵심 액션 1~3개로 압축
- "사용자는 \_\_\_을 할 수 있다"

### Why (왜 필요한가?)
- 현재 어떤 문제가 있는가?
- 어떤 사용자 니즈를 충족하는가?

### Scope (범위)
- **MVP**: 최소한 구현해야 할 것
- **Phase 2**: 이번에는 안 해도 되는 것 (명확히 분리)

---

## 3. 스펙 문서 작성

`docs/superpowers/` 또는 `docs/` 에 저장:

```markdown
# 기능명 스펙

## 개요
- 대상 사용자:
- 핵심 기능:

## DB 변경
| 테이블 | 변경 | 비고 |
|--------|------|------|
| posts  | visibility 컬럼 추가 | public/members/private |

## API
| 엔드포인트 | 권한 | 설명 |
|-----------|------|------|
| GET /api/... | 공개 | ... |

## FE 변경
- 신규 페이지: `/path` — 설명
- 변경 컴포넌트: `ComponentName.jsx` — 변경 내용

## 제외 범위 (이번 구현에서 제외)
- 항목1
- 항목2
```

---

## 4. 구현 우선순위 판단 기준

| 기준 | 높음 | 낮음 |
|------|------|------|
| 사용자 영향 | 핵심 기능 | Nice to have |
| 의존성 | 다른 기능의 전제 | 독립적 |
| 복잡도 | 단순 | 높음 |
| Phase | Phase 1 | Phase 3 |

---

## 5. 구현 계획 → task 분해

스펙 확정 후 구현 단계 분해:

```
1. DB 변경 (schema.py + migration)
   → 검증: 마이그레이션 파일 생성 + 적용 확인

2. BE API 추가
   → 검증: 각 엔드포인트 응답 확인

3. FE 페이지/컴포넌트 추가
   → 검증: 브라우저에서 동작 확인

4. api.md 업데이트
5. roadmap.md 구현 현황 업데이트
6. GitHub Projects 상태 변경
```

---

## 6. GitHub Projects 업데이트

```bash
# 완료된 기능을 Done으로 이동
gh project item-list 1 --owner funny419  # item ID 확인
gh project item-edit --project-id <id> --id <item-id> --field-id <field-id> --single-select-option-id <done-id>
# 또는 웹 UI에서 직접 변경
```
