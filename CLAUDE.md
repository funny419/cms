# CMS Project

React(FE) + Flask(BE) + MariaDB(DB) 기반 개인 블로그형 설치형 CMS.
Docker 컨테이너로 관리. main 브랜치 push → GitHub Actions → Windows 서버 자동 배포.

## CLAUDE.md 관리 규칙

- **이 파일은 200줄을 초과하면 안 됨** — 초과 시 `.claude/rules/` 파일로 분리할 것
- 새 내용 추가 시: 주제에 맞는 `.claude/rules/*.md` 파일에 작성 후 `@` import 추가
- 분리 단위: 환경/아키텍처/API/스토리지/CI-CD/트러블슈팅/로드맵

@.claude/rules/environment.md
@.claude/rules/architecture.md
@.claude/rules/api.md
@.claude/rules/storage.md
@.claude/rules/cicd.md
@.claude/rules/troubleshooting.md
@.claude/rules/roadmap.md
