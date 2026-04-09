# Engineering Workflow

## Branch Strategy

### `main`

- 배포 가능한 프로덕트 브랜치
- 항상 동작 가능한 상태를 유지한다
- 직접 개발하지 않고, 이슈 단위 브랜치에서 작업 후 병합한다

### Feature Branches

- 형식: `codex/s<번호>-<트랙>-<작업>`
- 예:
  - `codex/s1-foundation-ipc`
  - `codex/s1-ui-crud`
  - `codex/s1-ai-organize`
  - `codex/s1-search-context`

규칙:

- 모든 작업 브랜치는 `main`에서 분기한다
- 브랜치 하나는 하나의 GitHub 이슈에 대응한다
- 병합 후 브랜치는 자동 삭제한다

### Hotfix Branches

- 형식: `hotfix/<설명>`
- 운영 중인 `main` 문제를 빠르게 수정할 때만 사용한다

## GitHub Sprint Workflow

### 관리 단위

- 상위 계획: `Milestone`
- 기능 덩어리: `Feature` 이슈
- 실제 구현 단위: `Task` 이슈

### 권장 라벨

- `type:feature`
- `type:task`
- `area:foundation`
- `area:ui`
- `area:ai`
- `area:search`
- `area:quality`
- `priority:p0`
- `priority:p1`
- `priority:p2`

### 운영 규칙

- 모든 구현 작업은 GitHub 이슈를 먼저 만든다
- Feature 이슈 아래에 Task 이슈를 쪼갠다
- 스프린트 범위는 마일스톤으로 고정한다
- Codex 워킹트리는 Task 이슈 기준으로 만든다

## Codex Worktree Rules

- 워킹트리 하나는 하나의 활성 브랜치만 가진다
- 워킹트리 하나는 하나의 명확한 파일 책임 범위만 가진다
- 병렬 작업 브랜치는 가능한 한 서로 다른 디렉터리/모듈을 수정한다
- 공통 계약 변경이 필요한 경우 먼저 foundation 브랜치에서 인터페이스를 고정한다

## Sprint 1 Track Split

### Track A. Foundation

- 메모 도메인 모델
- 저장소 구조
- preload / IPC 계약

### Track B. Desktop UI CRUD

- 메모 목록 UI
- 에디터 UI
- CRUD 플로우

### Track C. AI Organize

- AI organize 요청 / 응답 계약
- 문장 다듬기
- 공손한 문체 변환

### Track D. Context Search

- 검색 입력 플로우
- 관련 메모 목록 반환
- 4초 목표 검증

### Track E. Quality

- acceptance checklist
- 주요 시나리오 검증
- 문서 정리

## Merge Order

권장 병합 순서:

1. Foundation
2. Desktop UI CRUD
3. AI Organize
4. Context Search
5. Quality

## PR Rules

- PR은 하나의 이슈 범위만 포함한다
- PR 설명에는 `무엇을 바꿨는지`, `왜 바꿨는지`, `검증 방법`을 적는다
- UI 브랜치와 AI/Search 브랜치가 같은 파일을 많이 건드리지 않도록 주의한다
