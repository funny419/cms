---
name: 리팩토링 이슈
about: 코드 리팩토링 작업 등록
title: '[리팩토링] '
labels: refactoring
assignees: ''
---

## 작업 내용

<!-- 무엇을 어떻게 리팩토링할지 설명 -->

## Simplicity First 체크 (필수)

### grep 사용처 확인 결과

새 추상화(함수/훅/Context/클래스/레이어)를 생성하는 경우 아래를 반드시 작성하세요.

```bash
# 실행한 grep 명령어
grep -rn "대상_패턴" backend/ frontend/src/ --include="*.py" --include="*.js" --include="*.jsx"
```

**결과:** 사용처 N개

| 사용처 수 | 판단 |
|---------|------|
| 10개 이상 | ✅ 추상화 정당 |
| 3~9개 | ✅ 추상화 권장 |
| 1~2개 | ⛔ team-lead 승인 필요 |

### 추상화 정당성 (사용처 1~2개인 경우 필수 작성)

- [ ] 가독성/유지보수 개선 목적이 명확함
- [ ] team-lead 승인을 받았음

### 표준 관례 확인

- [ ] Flask/SQLAlchemy/React 표준 관례를 SOLID 이유로 변경하는 경우, 명확한 이득이 있음
- [ ] "나중에 필요할 것 같아서"가 이유가 아님

---

## 영향 범위

- **수정 파일:**
- **의존성:**

## 검증 방법

- [ ] 테스트 통과 확인
- [ ] code-review.md 체크리스트 실행
