# Persistence Strategy

## Current Decision

기본 저장소는 SQLite(`userData/memos.db`)를 사용한다.

## 이유

- 메모 수가 증가해도 CRUD를 파일 전체 재기록 없이 처리할 수 있다.
- 인덱스/트랜잭션 기반으로 조회/수정 성능과 정합성을 유지하기 쉽다.
- renderer IPC 계약은 유지하면서 main process 저장소만 교체 가능하다.

## 데이터 모델

메모는 아래 필드를 가진다.

- `id`
- `title`
- `body`
- `createdAt`
- `updatedAt`

## 저장 및 마이그레이션 규칙

- 기본 DB 파일 위치: `app.getPath("userData")/memos.db`
- 테이블: `memos`, `schema_migrations`, `app_metadata`
- 기본 정렬: `updated_at` 내림차순
- 첫 실행 시 `memos.json` 또는 레거시 `notes.json`가 존재하면 SQLite로 자동 마이그레이션한다.
- JSON 원본 파일은 자동 삭제하지 않는다.

## 확장 포인트

- 검색 성능 고도화를 위한 SQLite FTS 테이블 추가
- AI organize 결과 이력/버전 테이블 추가
- 태그/노트북 등 관계형 확장 모델 도입
