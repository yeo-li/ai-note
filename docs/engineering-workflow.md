# Engineering Workflow

## Branch Roles

### `main`

- 배포 가능한 프로덕트 브랜치
- 항상 배포 가능한 상태를 유지한다
- 직접 개발하지 않고, `develop`을 거친 검증된 변경만 반영한다

### `develop`

- 일상적인 통합 기준 브랜치
- 새 이슈 브랜치와 Codex worktree는 모두 `develop`에서 시작한다
- PR의 base 브랜치는 항상 `develop`으로 고정한다
- `main` 기준선이 갱신되면 필요 시 `develop`을 동기화한다

### Task Branches

- 형식: `codex/s<번호>-<트랙>-<작업>`
- 예:
  - `codex/s29-monorepo-workspaces`
  - `codex/s30-server-bootstrap`
  - `codex/s31-shared-contract-foundation`

규칙:

- 모든 작업 브랜치는 `develop`에서 분기한다
- 브랜치 하나는 하나의 GitHub 이슈에 대응한다
- 브랜치와 worktree는 1:1로 대응시켜 현재 변경사항과 충돌하지 않게 유지한다
- 병합 후 브랜치는 자동 삭제한다

### Hotfix Branches

- 형식: `hotfix/<설명>`
- 운영 중인 `main` 문제를 빠르게 수정할 때만 사용한다

## Workspace Layout

- 루트는 `npm workspaces` 설정과 공통 명령 위임만 담당한다
- `apps/desktop`은 현재 Electron + React 앱과 검증 스크립트를 가진다
- `apps/server`는 후속 서버 이슈를 위한 자리만 확보한다
- `packages/shared`는 공용 계약/유틸리티를 수용할 자리만 확보한다

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

### 상태 라벨

- `status:blocked`
- `status:ready`
- `status:in-progress`

### 운영 규칙

- 모든 구현 작업은 GitHub 이슈를 먼저 만든다
- Feature 이슈 아래에 Task 이슈를 쪼갠다
- 스프린트 범위는 마일스톤으로 고정한다
- Codex 워킹트리는 Task 이슈 기준으로 만든다

### 의존성 표기 규칙

- 선행 작업이 필요한 이슈에는 `## 선행 이슈` 섹션을 둔다
- 선행 이슈가 없으면 `- 없음`이라고 적는다
- 선행 이슈가 하나라도 열려 있으면 후속 이슈는 `status:blocked`를 유지한다
- 선행 이슈가 모두 닫히면 후속 이슈를 `status:ready`로 변경한다
- 실제 작업을 시작하면 `status:in-progress`로 변경한다

## Codex Worktree Rules

- 워킹트리 하나는 하나의 활성 브랜치만 가진다
- 워킹트리 하나는 하나의 명확한 파일 책임 범위만 가진다
- 새 worktree는 가능한 한 `develop`에서 바로 분기한 이슈 브랜치로 생성한다
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

- Feature별 상세 선행 순서와 예외는 공통 문서가 아니라 해당 Feature 이슈 본문 또는 별도 계획 문서에서 관리한다.

## Dependency Gate

- `develop` 대상 PR은 반드시 `Closes #...`로 작업 이슈를 연결한다
- PR 본문에 `## Depends-On` 섹션을 두고 선행 이슈가 없으면 `- 없음`이라고 적는다
- workflow `PR Dependency Check`는 PR의 `Depends-On`과 연결 이슈의 `선행 이슈`를 함께 읽어 실제 의존성을 계산한다
- 연결 이슈가 `status:blocked`이면 상태 컨텍스트 `dependency-check`를 실패로 갱신한다
- 의존 이슈가 하나라도 열려 있으면 상태 컨텍스트 `dependency-check`를 실패로 갱신한다
- 이슈 상태가 바뀌었을 때도 같은 상태 컨텍스트를 다시 계산할 수 있도록 `issues` 이벤트 재평가 경로를 함께 유지한다
- 저장소 기본 브랜치가 `main`이면 `issues` 이벤트 workflow는 기본 브랜치의 workflow 파일을 사용하므로, 같은 재평가 경로를 `main`에도 반영해야 자동 갱신이 실제로 동작한다
- GitHub 브랜치 보호 규칙에서 상태 컨텍스트 `dependency-check`를 required status check로 수동 등록한다

## PR Rules

- PR은 하나의 이슈 범위만 포함한다
- PR base는 항상 `develop`이다
- PR 설명에는 `무엇을 바꿨는지`, `왜 바꿨는지`, `검증 방법`, `Depends-On`, `Closes #...`를 적는다
- UI 브랜치와 AI/Search 브랜치가 같은 파일을 많이 건드리지 않도록 주의한다

## Minimum Validation

- 최소 검증 명령은 루트에서 실행하는 `npm run build:renderer`이다
- 워크스페이스로 구조가 나뉘어도 데스크톱 기본 검증 진입점은 루트에서 유지한다
