# GitHub Task Backlog

이 문서는 현재 요구사항을 GitHub 이슈로 옮기기 위한 초기 백로그다.
권장 방식은 `Feature` 이슈를 상위 단위로 만들고, 실제 구현은 `Task` 이슈로 나누는 것이다.

## Feature 1. Desktop Memo CRUD MVP

목표:
- 데스크톱에서 메모 생성, 조회, 수정, 삭제가 가능해야 한다.

Task 후보:
- 메모 도메인 모델 정의
- 로컬 저장 방식 결정 및 저장소 구현
- preload / IPC CRUD 계약 추가
- 메모 목록 / 에디터 UI 구현
- 메모 삭제 흐름 구현

병렬 작업 가능:
- 저장소 / IPC
- UI CRUD

## Feature 2. AI Memo Organize

목표:
- 메모 내용을 문장 다듬기 또는 공손한 문체로 변환할 수 있어야 한다.

Task 후보:
- AI provider 선택 및 호출 방식 결정
- AI organize 요청 / 응답 계약 정의
- organize 실행 UI 추가
- 원본 대비 결과 검토 / 반영 흐름 구현

병렬 작업 가능:
- AI integration layer
- organize UI

## Feature 3. Context-based Search

목표:
- 자연어/맥락 기반 질의로 관련 메모 목록을 반환해야 한다.

Task 후보:
- 검색 요구사항 구체화
- 검색 인덱싱 또는 메타데이터 전략 결정
- 검색 API / IPC 계약 구현
- 검색 입력 UI 및 결과 리스트 구현
- 검색 성능 목표(4초 이내) 검증

병렬 작업 가능:
- 검색 로직
- 검색 UI

## Feature 4. Quality and Release Readiness

목표:
- 핵심 시나리오가 안정적으로 동작하고 이후 병렬 개발에도 기준점이 있어야 한다.

Task 후보:
- acceptance test 시나리오 정리
- 주요 사용자 플로우 수동 테스트 체크리스트 작성
- README / 개발 흐름 정리

## 권장 이슈 생성 순서

1. `Feature: Desktop Memo CRUD MVP`
2. `Task: 메모 도메인 모델 및 저장 방식 결정`
3. `Task: preload / IPC CRUD 계약 구현`
4. `Task: 메모 목록 / 에디터 UI 구현`
5. `Feature: AI Memo Organize`
6. `Task: AI organize integration`
7. `Feature: Context-based Search`
8. `Task: context search integration`
9. `Feature: Quality and Release Readiness`

## Codex Worktree 권장 매핑

- Worktree A: 저장소 / preload / IPC
- Worktree B: 데스크톱 UI CRUD
- Worktree C: AI organize
- Worktree D: context search
- Worktree E: 검증 / 문서 / acceptance checklist
