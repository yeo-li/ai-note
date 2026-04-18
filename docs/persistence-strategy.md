# Persistence Strategy

## Sprint 1 Decision

Sprint 1의 기본 저장소는 `userData/notes.json` 단일 파일 기반으로 시작한다.

## 이유

- 현재 우선순위는 빠른 CRUD 구현과 데스크톱 MVP 검증이다.
- 메모 수가 매우 많지 않은 초기 단계에서는 JSON 파일 저장이 가장 단순하다.
- Electron main process에서 파일 저장을 직접 제어하기 쉽다.
- preload / IPC 계약 위에 올리기 쉽고, 나중에 SQLite로 교체해도 renderer 계약을 유지할 수 있다.

## 현재 데이터 모델

메모는 아래 필드를 가진다.

- `id`
- `title`
- `body`
- `createdAt`
- `updatedAt`

## 저장 규칙

- 저장 파일 위치: `app.getPath("userData")/notes.json`
- 파일 구조: `version` + `notes[]`
- 정렬 기준: `updatedAt` 내림차순
- 쓰기 방식: 임시 파일 쓰기 후 rename

## 후속 확장 포인트

- context search를 위한 별도 인덱스 저장
- AI organize 결과 이력 저장
- SQLite 전환 시 repository 계층 유지
